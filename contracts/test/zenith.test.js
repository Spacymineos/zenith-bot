const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ZENITH_KEY = ethers.keccak256(ethers.toUtf8Bytes("ZENITH"));
const USD_KEY    = ethers.keccak256(ethers.toUtf8Bytes("USD"));

function ether(n) { return ethers.parseEther(n.toString()); }

// ─── Fixtures ─────────────────────────────────────────────────────────────────
async function deployBase() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  // Oracle
  const Oracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await Oracle.deploy(owner.address);
  await oracle.setPrice(ZENITH_KEY, ether(1));   // 1 USD per ZENITH
  await oracle.setPrice(USD_KEY,  ether(1));   // 1 USD per sUSD

  // MintController
  const MC = await ethers.getContractFactory("MintController");
  const mintCtrl = await MC.deploy(owner.address, owner.address);
  await owner.sendTransaction({ to: await mintCtrl.getAddress(), value: ether(500) });

  // Uniswap
  const WETH9F  = await ethers.getContractFactory("WETH9");
  const weth    = await WETH9F.deploy();
  const UniV2F  = await ethers.getContractFactory("UniswapV2Factory");
  const uniFactory = await UniV2F.deploy(owner.address);
  const RouterF = await ethers.getContractFactory("UniswapV2Router02");
  const router  = await RouterF.deploy(await uniFactory.getAddress(), await weth.getAddress());

  // Stablecoins + VaultManager
  const STF     = await ethers.getContractFactory("StablecoinToken");
  const sUSD    = await STF.deploy("Synthetic USD", "sUSD", owner.address);
  const VMF     = await ethers.getContractFactory("VaultManager");
  const vault   = await VMF.deploy(owner.address, await oracle.getAddress(), ZENITH_KEY);
  const vaultAddr = await vault.getAddress();
  const VAULT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_ROLE"));
  await sUSD.grantRole(VAULT_ROLE, vaultAddr);
  await vault.addStablecoin(USD_KEY, await sUSD.getAddress(), 15000, 200, USD_KEY);

  // MemeCoinFactory
  const MFF = await ethers.getContractFactory("MemeCoinFactory");
  const memeFactory = await MFF.deploy(
    await uniFactory.getAddress(),
    await weth.getAddress(),
    owner.address,
    owner.address
  );

  return { owner, alice, bob, carol, oracle, mintCtrl, weth, uniFactory, router, sUSD, vault, memeFactory };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe("MintController — Daily Claim Cooldown", function () {
  it("lets a user claim once and blocks second claim within 24h", async function () {
    const { alice, mintCtrl } = await loadFixture(deployBase);
    const balBefore = await ethers.provider.getBalance(alice.address);
    await mintCtrl.claimDaily(alice.address);
    const balAfter = await ethers.provider.getBalance(alice.address);
    expect(balAfter).to.be.gt(balBefore);

    // Immediate second claim should revert
    await expect(mintCtrl.claimDaily(alice.address))
      .to.be.revertedWith("MintController: cooldown active");
  });

  it("allows claim again after 24h passes", async function () {
    const { alice, mintCtrl } = await loadFixture(deployBase);
    await mintCtrl.claimDaily(alice.address);
    await time.increase(24 * 3600 + 1);
    await expect(mintCtrl.claimDaily(alice.address)).to.not.be.reverted;
  });

  it("reward halves every 30 days", async function () {
    const { mintCtrl } = await loadFixture(deployBase);
    const initial = await mintCtrl.currentReward();
    expect(initial).to.equal(ether(100));

    await time.increase(30 * 24 * 3600);
    const after30 = await mintCtrl.currentReward();
    expect(after30).to.equal(ether(50));

    await time.increase(30 * 24 * 3600);
    const after60 = await mintCtrl.currentReward();
    expect(after60).to.equal(ether(25));
  });

  it("mintWork requires BOT_ROLE", async function () {
    const { alice, bob, mintCtrl } = await loadFixture(deployBase);
    await expect(
      mintCtrl.connect(alice).mintWork(bob.address, ether(10))
    ).to.be.reverted;
  });

  it("mintWork succeeds for BOT_ROLE", async function () {
    const { owner, alice, mintCtrl } = await loadFixture(deployBase);
    const BOT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BOT_ROLE"));
    await mintCtrl.grantRole(BOT_ROLE, owner.address);
    const balBefore = await ethers.provider.getBalance(alice.address);
    await mintCtrl.mintWork(alice.address, ether(5));
    expect(await ethers.provider.getBalance(alice.address)).to.be.gt(balBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("VaultManager — Liquidation Threshold", function () {
  it("mints sUSD against COIN collateral", async function () {
    const { alice, vault, sUSD } = await loadFixture(deployBase);
    // Deposit 200 COIN as collateral
    await vault.connect(alice).deposit(USD_KEY, { value: ether(200) });
    // Borrow 100 sUSD (1 USD each, 200% CR)
    await vault.connect(alice).mint(USD_KEY, ether(100));
    const bal = await sUSD.balanceOf(alice.address);
    expect(bal).to.equal(ether(100));
  });

  it("prevents minting below collateral ratio", async function () {
    const { alice, vault } = await loadFixture(deployBase);
    await vault.connect(alice).deposit(USD_KEY, { value: ether(100) });
    // 100 COIN at $1 = $100 collateral; 150% CR → max borrow = $66.67
    await expect(
      vault.connect(alice).mint(USD_KEY, ether(70))
    ).to.be.revertedWith("VaultManager: below ratio");
  });

  it("allows liquidation when CR drops below 110%", async function () {
    const { owner, alice, bob, oracle, vault, sUSD } = await loadFixture(deployBase);
    // Alice deposits 110 COIN, borrows 99 sUSD → ~111% CR at $1/COIN
    await vault.connect(alice).deposit(USD_KEY, { value: ether(110) });
    await vault.connect(alice).mint(USD_KEY, ether(73));   // 150% safe

    // Price crash: COIN drops to $0.80 → CR = (110 * 0.80) / 73 = 120% (still safe)
    // Crash harder to $0.70 → CR = (110 * 0.70) / 73 = 105% < 110% → liquidatable
    await oracle.setPrice(COIN_KEY, ether("0.70"));

    // Bob needs sUSD to liquidate — give him some
    // Re-use owner's sUSD mint path
    await vault.connect(owner).deposit(USD_KEY, { value: ether(5000) });
    await vault.connect(owner).mint(USD_KEY, ether(74));
    await sUSD.connect(owner).transfer(bob.address, ether(74));

    const bobBalBefore = await ethers.provider.getBalance(bob.address);
    await vault.connect(bob).liquidate(alice.address, USD_KEY);
    const bobBalAfter = await ethers.provider.getBalance(bob.address);

    // Bob should have gained COIN (minus gas)
    const aliceVault = await vault.vaults(alice.address, USD_KEY);
    expect(aliceVault.debt).to.equal(0n);
  });

  it("rejects liquidation when vault is healthy", async function () {
    const { alice, bob, vault, sUSD, owner } = await loadFixture(deployBase);
    await vault.connect(alice).deposit(USD_KEY, { value: ether(300) });
    await vault.connect(alice).mint(USD_KEY, ether(100));

    // Give bob sUSD so he could theoretically liquidate
    await vault.connect(owner).deposit(USD_KEY, { value: ether(500) });
    await vault.connect(owner).mint(USD_KEY, ether(100));
    await sUSD.connect(owner).transfer(bob.address, ether(100));

    await expect(
      vault.connect(bob).liquidate(alice.address, USD_KEY)
    ).to.be.revertedWith("VaultManager: healthy");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("MemeCoinFactory — Creation Fee", function () {
  it("reverts when payment is below creation fee", async function () {
    const { alice, memeFactory } = await loadFixture(deployBase);
    await expect(
      memeFactory.connect(alice).createToken("TestCoin", "TEST", { value: ether(500) })
    ).to.be.revertedWith("MemeCoinFactory: insufficient fee");
  });

  it("creates token and pair with exact fee", async function () {
    const { alice, memeFactory } = await loadFixture(deployBase);
    const tx = await memeFactory.connect(alice).createToken("TestCoin", "TEST", {
      value: ether(1000),
    });
    const receipt = await tx.wait();
    const event = receipt.logs.find((l) => {
      try { return memeFactory.interface.parseLog(l)?.name === "TokenCreated"; } catch { return false; }
    });
    expect(event).to.not.be.undefined;
    const parsed = memeFactory.interface.parseLog(event);
    expect(parsed.args.creator).to.equal(alice.address);

    // Verify MemeToken initial supply went to creator
    const MemeToken = await ethers.getContractFactory("MemeToken");
    const token = MemeToken.attach(parsed.args.tokenAddress);
    const bal = await token.balanceOf(alice.address);
    expect(bal).to.equal(ethers.parseEther("1000000"));
  });

  it("owner can update creation fee", async function () {
    const { owner, memeFactory } = await loadFixture(deployBase);
    await memeFactory.connect(owner).setCreationFee(ether(500));
    expect(await memeFactory.creationFee()).to.equal(ether(500));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("DEX — Swap Round-Trip", function () {
  it("adds liquidity and swaps ETH for token and back", async function () {
    const { owner, alice, weth, uniFactory, router, memeFactory } = await loadFixture(deployBase);

    // Create meme token
    const tx = await memeFactory.connect(owner).createToken("SwapTest", "SWT", { value: ether(1000) });
    const receipt = await tx.wait();
    const event = receipt.logs.find((l) => {
      try { return memeFactory.interface.parseLog(l)?.name === "TokenCreated"; } catch { return false; }
    });
    const tokenAddr = memeFactory.interface.parseLog(event).args.tokenAddress;

    const MemeToken = await ethers.getContractFactory("MemeToken");
    const token = MemeToken.attach(tokenAddr);
    const routerAddr = await router.getAddress();
    const wethAddr = await weth.getAddress();

    // Approve router to spend token
    await token.connect(owner).approve(routerAddr, ether(500000));

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Add liquidity: 500k token + 1000 COIN
    await router.connect(owner).addLiquidityETH(
      tokenAddr,
      ether(500000),  // token amount
      ether(490000),  // min token
      ether(990),     // min ETH
      owner.address,
      deadline,
      { value: ether(1000) }
    );

    // Alice swaps 1 COIN for SWT
    const path = [wethAddr, tokenAddr];
    const amounts = await router.getAmountsOut(ether(1), path);
    expect(amounts[1]).to.be.gt(0n);

    const balBefore = await token.balanceOf(alice.address);
    await router.connect(alice).swapExactETHForTokens(
      0n, path, alice.address, deadline, { value: ether(1) }
    );
    const balAfter = await token.balanceOf(alice.address);
    expect(balAfter).to.be.gt(balBefore);

    // Alice swaps back: SWT → COIN
    const swtBal = await token.balanceOf(alice.address);
    await token.connect(alice).approve(routerAddr, swtBal);
    const ethBefore = await ethers.provider.getBalance(alice.address);
    const swapTx = await router.connect(alice).swapExactTokensForETH(
      swtBal, 0n, [tokenAddr, wethAddr], alice.address, deadline
    );
    const swapReceipt = await swapTx.wait();
    const gasCost = swapReceipt.gasUsed * swapReceipt.gasPrice;
    const ethAfter = await ethers.provider.getBalance(alice.address);
    expect(ethAfter + gasCost).to.be.gt(ethBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("PriceOracle", function () {
  it("reverts getPrice for unset asset", async function () {
    const { oracle } = await loadFixture(deployBase);
    const unknownKey = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
    await expect(oracle.getPrice(unknownKey)).to.be.revertedWith("PriceOracle: no price set");
  });

  it("only owner can setPrice", async function () {
    const { oracle, alice } = await loadFixture(deployBase);
    const key = ethers.keccak256(ethers.toUtf8Bytes("TEST"));
    await expect(oracle.connect(alice).setPrice(key, ether(1))).to.be.reverted;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("MinerRegistry", function () {
  it("records hashrate and returns top miners", async function () {
    const [, miner1, miner2, miner3] = await ethers.getSigners();
    const MR = await ethers.getContractFactory("MinerRegistry");
    const registry = await MR.deploy();

    await registry.connect(miner1).submitHashrate(5000);
    await registry.connect(miner2).submitHashrate(12000);
    await registry.connect(miner3).submitHashrate(8000);

    const [addrs, rates] = await registry.getTopMiners(3);
    expect(addrs[0]).to.equal(miner2.address);
    expect(rates[0]).to.equal(12000n);
    expect(addrs[1]).to.equal(miner3.address);
    expect(rates[1]).to.equal(8000n);
    expect(addrs[2]).to.equal(miner1.address);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("NFTCollection", function () {
  it("mints NFT and generates on-chain SVG URI", async function () {
    const [owner, alice] = await ethers.getSigners();
    const NF = await ethers.getContractFactory("NFTCollection");
    const nft = await NF.deploy(owner.address, owner.address);
    await nft.mint(alice.address, 1);
    const uri = await nft.tokenURI(1);
    expect(uri).to.match(/^data:application\/json;base64,/);
  });

  it("allows buying listed NFT", async function () {
    const [owner, alice] = await ethers.getSigners();
    const NF = await ethers.getContractFactory("NFTCollection");
    const nft = await NF.deploy(owner.address, owner.address);
    await nft.mint(alice.address, 42);
    await nft.setPrice(42, ether(10));

    // alice must approve transfer — but buy() uses _transfer internal, so owner of token
    // needs to approve NFT contract or use setApprovalForAll
    await nft.connect(alice).setApprovalForAll(await nft.getAddress(), true);

    const [, , buyer] = await ethers.getSigners();
    await nft.connect(buyer).buy(42, { value: ether(10) });
    expect(await nft.ownerOf(42)).to.equal(buyer.address);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("GovernanceToken", function () {
  it("owner mints governance tokens with vote tracking", async function () {
    const [owner, alice] = await ethers.getSigners();
    const GT = await ethers.getContractFactory("GovernanceToken");
    const gov = await GT.deploy(owner.address);
    await gov.mint(alice.address, ether(1000));
    expect(await gov.balanceOf(alice.address)).to.equal(ether(1000));
    // Delegate to self to activate votes
    await gov.connect(alice).delegate(alice.address);
    expect(await gov.getVotes(alice.address)).to.equal(ether(1000));
  });
});
