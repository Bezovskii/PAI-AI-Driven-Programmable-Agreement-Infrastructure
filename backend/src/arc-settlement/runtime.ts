import {
  Interface,
  JsonRpcProvider,
} from "ethers";

export const ARC_TESTNET_CHAIN_ID =
  5_042_002n;

export const ARC_TESTNET_RPC_URL =
  "https://rpc.testnet.arc.io";

export const ARC_TESTNET_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";

export const ARC_USDC_DECIMALS =
  6;

const USDC_READ_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

const USDC_READ_INTERFACE =
  new Interface(
    USDC_READ_ABI,
  );

export interface ArcProvider {
  getNetwork():
    ReturnType<
      JsonRpcProvider["getNetwork"]
    >;

  getBlockNumber():
    ReturnType<
      JsonRpcProvider["getBlockNumber"]
    >;

  getCode(
    address:
      string,
  ):
    ReturnType<
      JsonRpcProvider["getCode"]
    >;

  call(
    transaction:
      Parameters<
        JsonRpcProvider["call"]
      >[0],
  ):
    ReturnType<
      JsonRpcProvider["call"]
    >;

  getTransactionReceipt(
    transactionHash:
      string,
  ):
    ReturnType<
      JsonRpcProvider[
        "getTransactionReceipt"
      ]
    >;
}

export interface ArcEnvironmentVerification {
  readonly chainId:
    bigint;

  readonly latestBlock:
    number;

  readonly usdcAddress:
    string;

  readonly usdcName:
    string;

  readonly usdcSymbol:
    string;

  readonly usdcDecimals:
    number;
}

export interface ArcTransactionVerification {
  readonly transactionHash:
    string;

  readonly blockNumber:
    number;

  readonly status:
    "CONFIRMED";
}

export class ArcNetworkMismatchError
  extends Error {
  constructor(
    readonly actualChainId:
      bigint,
  ) {
    super(
      `Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID.toString()}, received ${actualChainId.toString()}.`,
    );

    this.name =
      "ArcNetworkMismatchError";
  }
}

export class ArcUsdcVerificationError
  extends Error {
  constructor(
    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      "ArcUsdcVerificationError";
  }
}

export class ArcTransactionNotFoundError
  extends Error {
  constructor(
    readonly transactionHash:
      string,
  ) {
    super(
      `Arc transaction ${transactionHash} is not confirmed yet or was not found.`,
    );

    this.name =
      "ArcTransactionNotFoundError";
  }
}

export class ArcTransactionFailedError
  extends Error {
  constructor(
    readonly transactionHash:
      string,
  ) {
    super(
      `Arc transaction ${transactionHash} reverted.`,
    );

    this.name =
      "ArcTransactionFailedError";
  }
}

export function createArcProvider(
  rpcUrl =
    process.env.ARC_RPC_URL ??
    ARC_TESTNET_RPC_URL,
): ArcProvider {
  return new JsonRpcProvider(
    rpcUrl,
  );
}

async function requireArcNetwork(
  provider:
    ArcProvider,
): Promise<void> {
  const network =
    await provider.getNetwork();

  if (
    network.chainId !==
    ARC_TESTNET_CHAIN_ID
  ) {
    throw new ArcNetworkMismatchError(
      network.chainId,
    );
  }
}

export async function verifyArcEnvironment(
  provider:
    ArcProvider =
      createArcProvider(),
): Promise<ArcEnvironmentVerification> {
  await requireArcNetwork(
    provider,
  );

  const [
    latestBlock,
    usdcCode,
  ] =
    await Promise.all([
      provider.getBlockNumber(),

      provider.getCode(
        ARC_TESTNET_USDC_ADDRESS,
      ),
    ]);

  if (
    usdcCode ===
    "0x"
  ) {
    throw new ArcUsdcVerificationError(
      "Arc Testnet USDC contract code is missing.",
    );
  }

  const [
    nameResponse,
    symbolResponse,
    decimalsResponse,
  ] =
    await Promise.all([
      provider.call({
        to:
          ARC_TESTNET_USDC_ADDRESS,

        data:
          USDC_READ_INTERFACE
            .encodeFunctionData(
              "name",
            ),
      }),

      provider.call({
        to:
          ARC_TESTNET_USDC_ADDRESS,

        data:
          USDC_READ_INTERFACE
            .encodeFunctionData(
              "symbol",
            ),
      }),

      provider.call({
        to:
          ARC_TESTNET_USDC_ADDRESS,

        data:
          USDC_READ_INTERFACE
            .encodeFunctionData(
              "decimals",
            ),
      }),
    ]);

  const name =
    USDC_READ_INTERFACE
      .decodeFunctionResult(
        "name",
        nameResponse,
      )[0] as string;

  const symbol =
    USDC_READ_INTERFACE
      .decodeFunctionResult(
        "symbol",
        symbolResponse,
      )[0] as string;

  const decimals =
    USDC_READ_INTERFACE
      .decodeFunctionResult(
        "decimals",
        decimalsResponse,
      )[0] as bigint;

  if (
    decimals !==
    BigInt(
      ARC_USDC_DECIMALS,
    )
  ) {
    throw new ArcUsdcVerificationError(
      `Expected Arc USDC to use ${ARC_USDC_DECIMALS} decimals, received ${decimals.toString()}.`,
    );
  }

  return {
    chainId:
      ARC_TESTNET_CHAIN_ID,

    latestBlock,

    usdcAddress:
      ARC_TESTNET_USDC_ADDRESS,

    usdcName:
      name,

    usdcSymbol:
      symbol,

    usdcDecimals:
      Number(
        decimals,
      ),
  };
}

export async function verifyArcTransaction(
  transactionHash:
    string,
  provider:
    ArcProvider =
      createArcProvider(),
): Promise<ArcTransactionVerification> {
  await requireArcNetwork(
    provider,
  );

  const receipt =
    await provider
      .getTransactionReceipt(
        transactionHash,
      );

  if (
    !receipt
  ) {
    throw new ArcTransactionNotFoundError(
      transactionHash,
    );
  }

  if (
    receipt.status !==
    1
  ) {
    throw new ArcTransactionFailedError(
      transactionHash,
    );
  }

  return {
    transactionHash:
      receipt.hash,

    blockNumber:
      receipt.blockNumber,

    status:
      "CONFIRMED",
  };
}
