require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Zenith Protocol Suite — Deployment Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "Zenith Coin");
  console.log("Chain ID :", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const deployments = {};

  async function deploy(label, contractName, args = [], value = 0n) {
    const factory = await ethers.getContractFactory(contractName);
    const contract = value > 0n
      ? await factory.deploy(...args, { value })
      : await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`✅ ${label.padEnd(26)} → ${address}`);
    deployments[label] = {
      address,
      contractName,
      deployedAt: new Date().toISOString(),
    };
    return { contract, address };
  }

  // ── 1. PriceOracle ─────────────────────────────────────────────────────────
  const { contract: oracle } = await deploy("PriceOracle", "PriceOracle", [deployer.address]);

  // Seed initial prices (18-decimal USD)
  const ZENITH_KEY = ethers.keccak256(ethers.toUtf8Bytes("ZENITH"));
  const USD_KEY    = ethers.keccak256(ethers.toUtf8Bytes("USD"));
  const EUR_KEY    = ethers.keccak256(ethers.toUtf8Bytes("EUR"));
  const GOLD_KEY   = ethers.keccak256(ethers.toUtf8Bytes("GOLD"));
  const BTC_KEY    = ethers.keccak256(ethers.toUtf8Bytes("BTC"));

  await oracle.setPrice(ZENITH_KEY, ethers.parseEther("1"));         // 1 USD
  await oracle.setPrice(USD_KEY,    ethers.parseEther("1"));         // 1 USD
  await oracle.setPrice(EUR_KEY,    ethers.parseEther("1.08"));      // ~1.08 USD
  await oracle.setPrice(GOLD_KEY,   ethers.parseEther("2350"));      // 2350 USD
  await oracle.setPrice(BTC_KEY,    ethers.parseEther("65000"));     // 65k USD
  console.log("   └─ Initial prices seeded\n");

  // ── 2. MintController ──────────────────────────────────────────────────────
  const TREASURY = deployer.address; // use deployer as treasury in dev; override in prod
  const { contract: mintCtrl } = await deploy("MintController", "MintController", [
    deployer.address,
    TREASURY,
  ]);
  // Fund MintController with some COIN for claims
  const seedTx = await deployer.sendTransaction({
    to: await mintCtrl.getAddress(),
    value: ethers.parseEther("10000"),
  });
  await seedTx.wait();
  console.log("   └─ MintController funded with 10,000 COIN\n");

  // ── 3. Uniswap V2 ──────────────────────────────────────────────────────────
  const { contract: weth, address: wethAddr } = await deploy("WETH9", "WETH9");
  const { contract: uniFactory, address: uniFactoryAddr } = await deploy(
    "UniswapV2Factory", "UniswapV2Factory", [TREASURY]
  );
  await uniFactory.setFeeTo(TREASURY);
  const { contract: uniRouter } = await deploy(
    "UniswapV2Router02", "UniswapV2Router02", [uniFactoryAddr, wethAddr]
  );
  console.log("   └─ Uniswap feeTo set to treasury\n");

  // ── 4. StablecoinTokens ────────────────────────────────────────────────────
  const { contract: sUSD, address: sUSDAddr } = await deploy("sUSD", "StablecoinToken", ["Synthetic USD", "sUSD", deployer.address]);
  const { contract: sEUR, address: sEURAddr } = await deploy("sEUR", "StablecoinToken", ["Synthetic EUR", "sEUR", deployer.address]);
  const { contract: sGOLD, address: sGOLDAddr } = await deploy("sGOLD", "StablecoinToken", ["Synthetic GOLD", "sGOLD", deployer.address]);
  const { contract: sBTC, address: sBTCAddr } = await deploy("sBTC", "StablecoinToken", ["Synthetic BTC", "sBTC", deployer.address]);
  console.log();

  // ── 5. VaultManager ────────────────────────────────────────────────────────
  const oracleAddr = await oracle.getAddress();
  const { contract: vault } = await deploy("VaultManager", "VaultManager", [
    deployer.address, oracleAddr, ZENITH_KEY
  ]);
  const vaultAddr = await vault.getAddress();

  // Grant VAULT_ROLE to VaultManager on each stablecoin
  const VAULT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_ROLE"));
  for (const [label, token] of [["sUSD", sUSD], ["sEUR", sEUR], ["sGOLD", sGOLD], ["sBTC", sBTC]]) {
    await token.grantRole(VAULT_ROLE, vaultAddr);
    console.log(`   └─ VAULT_ROLE granted on ${label}`);
  }

  // Register stablecoins in VaultManager (150% CR, 2% fee)
  await vault.addStablecoin(USD_KEY,  sUSDAddr,  15000, 200, USD_KEY);
  await vault.addStablecoin(EUR_KEY,  sEURAddr,  15000, 200, EUR_KEY);
  await vault.addStablecoin(GOLD_KEY, sGOLDAddr, 15000, 200, GOLD_KEY);
  await vault.addStablecoin(BTC_KEY,  sBTCAddr,  15000, 200, BTC_KEY);
  console.log("   └─ All stablecoins registered in VaultManager\n");

  // ── 6. MemeCoinFactory ─────────────────────────────────────────────────────
  const { contract: memeFactory } = await deploy("MemeCoinFactory", "MemeCoinFactory", [
    uniFactoryAddr, wethAddr, TREASURY, deployer.address
  ]);
  console.log();

  // ── 7. NFTCollection ───────────────────────────────────────────────────────
  const { contract: nftCollection } = await deploy("NFTCollection", "NFTCollection", [
    deployer.address, TREASURY
  ]);
  console.log();

  // ── 8. MinerRegistry ───────────────────────────────────────────────────────
  await deploy("MinerRegistry", "MinerRegistry");
  console.log();

  // ── 9. GovernanceToken ─────────────────────────────────────────────────────
  await deploy("GovernanceToken", "GovernanceToken", [deployer.address]);
  console.log();

  // ── Save deployments.json ──────────────────────────────────────────────────
  // Attach ABIs
  for (const [label, info] of Object.entries(deployments)) {
    try {
      const artifact = await ethers.getContractFactory(info.contractName);
      info.abi = JSON.parse(artifact.interface.formatJson());
    } catch (_) {}
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 10. Update src/config.ts ──────────────────────────────────────────────
  const configPath = path.join(__dirname, "..", "..", "src", "config.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf8");
    
    // Create new addresses block
    let newAddressesBlock = "export const CONTRACT_ADDRESSES = {\n";
    for (const [label, info] of Object.entries(deployments)) {
      newAddressesBlock += `  ${label.padEnd(18)}: "${info.address}",\n`;
    }
    // Handle the specific naming mismatch if any (e.g., WETH vs WETH9)
    if (deployments["WETH9"] && !deployments["WETH"]) {
        newAddressesBlock += `  WETH              : "${deployments["WETH9"].address}",\n`;
    }
    newAddressesBlock += "};";

    // Replace the old block
    const regex = /export const CONTRACT_ADDRESSES = \{[\s\S]*?\};/;
    configContent = configContent.replace(regex, newAddressesBlock);
    
    fs.writeFileSync(configPath, configContent);
    console.log(`✅ src/config.ts updated → ${configPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
