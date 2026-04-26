export const CHAIN_ID = 13371;
export const RPC_URL = process.env.RPC_URL ?? "http://geth:8545";
export const CONTRACT_ADDRESSES = {
    MintController: "0x0000000000000000000000000000000000000001",
    MinerRegistry: "0x0000000000000000000000000000000000000002",
    MemeCoinFactory: "0x0000000000000000000000000000000000000003",
    PriceOracle: "0x0000000000000000000000000000000000000004",
    UniswapV2Router: "0x0000000000000000000000000000000000000005",
    UniswapV2Factory: "0x0000000000000000000000000000000000000006",
    WETH: "0x0000000000000000000000000000000000000007",
    VaultManager: "0x0000000000000000000000000000000000000008",
    NFTCollection: "0x0000000000000000000000000000000000000009",
    LeaderboardHelper: "0x000000000000000000000000000000000000000A"
};
export const ABIS = {
    MintController: [
        "function claimDaily(address user) external returns (uint256 amount)",
        "function mintReward(address user, uint256 amount) external",
        "function getDailyReward() external view returns (uint256)",
        "function getBaseReward() external view returns (uint256)"
    ],
    MinerRegistry: [
        "function getHashrate(address miner) external view returns (uint256)",
        "function getTopMiners(uint256 count) external view returns (address[] memory miners, uint256[] memory hashrates)",
        "function getMinerRank(address miner) external view returns (uint256 rank, uint256 total)",
        "function getTotalHashrate() external view returns (uint256)",
        "function getBlockReward() external view returns (uint256)"
    ],
    MemeCoinFactory: [
        "function createToken(string memory name, string memory symbol) external payable returns (address tokenAddress)",
        "function getCreationFee() external view returns (uint256)",
        "function getTokenBySymbol(string memory symbol) external view returns (address)"
    ],
    PriceOracle: [
        "function getPrice(address asset) external view returns (uint256 priceUSD)",
        "function getNativePrice() external view returns (uint256 priceUSD)",
        "function get24hChange(address asset) external view returns (int256 changePercent)"
    ],
    UniswapV2Router: [
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
        "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
        "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
        "function WETH() external pure returns (address)"
    ],
    UniswapV2Factory: [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)"
    ],
    UniswapV2Pair: [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function totalSupply() external view returns (uint256)"
    ],
    VaultManager: [
        "function deposit(uint256 amount) external payable",
        "function mint(address stablecoin, uint256 amount) external",
        "function repay(uint256 amount) external",
        "function getVaultStatus(address user) external view returns (uint256 collateral, uint256 minted, uint256 ratio, uint256 liquidationPrice)",
        "function getMinRatio() external view returns (uint256)"
    ],
    NFTCollection: [
        "function getShopItems() external view returns (uint256[] memory ids, string[] memory names, uint256[] memory prices, uint256[] memory stocks)",
        "function purchase(uint256 itemId) external payable",
        "function balanceOf(address owner) external view returns (uint256)",
        "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
        "function tokenURI(uint256 tokenId) external view returns (string memory)",
        "function getItemName(uint256 tokenId) external view returns (string memory)"
    ],
    ERC20: [
        "function name() external view returns (string memory)",
        "function symbol() external view returns (string memory)",
        "function decimals() external view returns (uint8)",
        "function balanceOf(address account) external view returns (uint256)",
        "function totalSupply() external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)"
    ]
};
export const TOKEN_SYMBOLS = {
    COIN: "COIN",
};
export const STABLECOIN_KEYS = ["USD"];
export const VAULT_MIN_RATIO = 1.5;
//# sourceMappingURL=index.js.map