import arg from "arg";
import { givers100, givers1000, givers10000 } from "./givers";
import { TonClient4 } from "@ton/ton";
import { LiteClient, LiteRoundRobinEngine, LiteSingleEngine } from "ton-lite-client";
import { Address, Cell, parseTuple, TupleReader } from "@ton/core";
import { getSecureRandomBytes, mnemonicToWalletKey } from "@ton/crypto";
import { ChildProcess, spawn } from "child_process";
import { Wallets } from 'ton3-contracts';
import * as ton3 from 'ton3-core';
import fs from "fs";
import axios from "axios";
import { BOC } from "ton3-core";
import { WalletTransfer } from "ton3-contracts/dist/types/wallet-transfer";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const MINE_TO_WALLET = process.env.MINE_TO_WALLET as string;
const MY_SEED = process.env.MY_SEED as string;

const args = arg({
  "--givers": Number, // 100 1000 10000
  "--bin": String, // cuda, opencl or path to miner
  "--gpu": Number, // gpu id, default 0
  "--gpu-count": Number, // GPU COUNT!!!
  "--timeout": Number, // Timeout for mining in seconds
  "-c": String, // blockchain config
});

/* Выбор гиверов */
let givers = givers10000;
if (args["--givers"]) {
  const val = args["--givers"];
  const allowed = [100, 1000, 10000];
  if (!allowed.includes(val)) {
    throw new Error("Invalid --givers argument");
  }
  switch (val) {
    case 100:
      givers = givers100;
      console.log("Using givers 100");
      break;
    case 1000:
      givers = givers1000;
      console.log("Using givers 1 000");
      break;
    case 10000:
      givers = givers10000;
      console.log("Using givers 10 000");
      break;
  }
} else {
  console.log("Using givers 10 000");
}

/* Выбор бинарника */
let bin = ".\\pow-miner-cuda.exe";
if (args["--bin"]) {
  const argBin = args["--bin"];
  if (argBin === "cuda") {
    bin = ".\\pow-miner-cuda.exe";
  } else if (argBin === "opencl" || argBin === "amd") {
    bin = ".\\pow-miner-opencl.exe";
  } else {
    bin = argBin;
  }
}
console.log("Using bin", bin);

/* Количества GPU и таймаут */
const gpus = args["--gpu-count"] || 1;
const timeout = args["--timeout"] ?? 5;

console.log("Using GPUs count", gpus);
console.log("Using timeout", timeout);

const delay = async (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

let bestGiver: { address: string; coins: number } = { address: "", coins: 0 };
const updateBestGivers = () => {
  const giver = givers[Math.floor(Math.random() * givers.length)];
  bestGiver = {
      address: giver.address,
      coins: giver.reward,
  };
};

const intToIP = (int: number): string => {
    const part1 = int & 255;
    const part2 = (int >> 8) & 255;
    const part3 = (int >> 16) & 255;
    const part4 = (int >> 24) & 255;

    return `${part4}.${part3}.${part2}.${part1}`
};

const callForSuccess = async <T extends (...args: any[]) => any>(
  toCall: T,
  attempts = 50,
  delayMs = 100
): Promise<ReturnType<T>> => {
  if (typeof toCall !== "function") {
    throw new Error("unknown input");
  }

  let i = 0;
  let lastError: unknown;

  while (i < attempts) {
    try {
      return await toCall();
    } catch (err) {
      lastError = err;
      i++;
      await delay(delayMs);
    }
  }
  console.log("error after attempts", i);
  throw lastError;
}

let lc: LiteClient | undefined = undefined;
let createLiteClient: Promise<void>;
const getLiteClient = async (_configUrl): Promise<LiteClient> => {
  if (lc) {
    return lc;
  }

  if (!createLiteClient) {
    createLiteClient = (async () => {
      const { data } = await axios(_configUrl);
      const liteServers = data.liteservers;
      const engines: any[] = [];
      for (const server of liteServers) {
        const ls = server;
        engines.push(
          new LiteSingleEngine({
            host: `tcp://${intToIP(ls.ip)}:${ls.port}`,
            publicKey: Buffer.from(ls.id.key, 'base64'),
          })
        );
      }
      const engine = new LiteRoundRobinEngine(engines);
      lc = new LiteClient({
        engine,
        batchSize: 1,
      });
    })();
  }
  await createLiteClient;
  return lc as any;
}

const getPowInfo = async (
  liteClient: TonClient4 | LiteClient,
  address: Address
): Promise<[bigint, bigint, bigint]> => {
  if (liteClient instanceof TonClient4) {
    const lastInfo = await callForSuccess(() => liteClient.getLastBlock());
    const powInfo = await callForSuccess(() =>
      liteClient.runMethod(lastInfo.last.seqno, address, "get_pow_params", [])
    );

    const reader = new TupleReader(powInfo.result);
    const seed = reader.readBigNumber();
    const complexity = reader.readBigNumber();
    const iterations = reader.readBigNumber();
    
    return [seed, complexity, iterations];
  } else if (liteClient instanceof LiteClient) {
    const lastInfo = await liteClient.getMasterchainInfo();
    const powInfo = await liteClient.runMethod(
      address,
      "get_pow_params",
      Buffer.from([]),
      lastInfo.last
    );
    const powStack = Cell.fromBase64(powInfo.result as string);
    const stack = parseTuple(powStack);

    const reader = new TupleReader(stack);
    const seed = reader.readBigNumber();
    const complexity = reader.readBigNumber();
    const iterations = reader.readBigNumber();

    return [seed, complexity, iterations];
  }
  throw new Error("invalid client");
};

const sendMinedBoc = async (
  giverAddress: string,
  boc: Cell
) => {
  const walletKeys = await mnemonicToWalletKey(MY_SEED.split(','));
  const walletHighload = new Wallets.ContractHighloadWalletV2({
    workchain: 0,
    publicKey: walletKeys.publicKey,
    subwalletId: 698983191,
  });
  const transfers: WalletTransfer[] = [];
  transfers.push({
    destination: new ton3.Address(giverAddress),
    amount: new ton3.Coins('0.05'),
    body: BOC.from(boc.toString()).root[0],
    mode: 3
  });

  const payments = walletHighload
      .createTransferMessage(transfers)
      .sign(walletKeys.secretKey);

  const liteClient = await getLiteClient(
      args["-c"] ?? "https://ton-blockchain.github.io/global.config.json"
  );
  try {
    await liteClient.sendMessage(Buffer.from(new BOC([payments]).toBytes()));
  } catch (e) {
    console.log(e);
  }
}

let go = true;
let i = 0;
let lastMinedSeed: bigint = BigInt(0);
const main = async () => {
  console.log("Using LiteServer API");
  const liteClient = await getLiteClient(
      args["-c"] ?? "https://ton-blockchain.github.io/global.config.json"
  );

  updateBestGivers();
  
  setInterval(() => {
    updateBestGivers();
  }, 1000);

  while (go) {
    const giverAddress = bestGiver.address;
    const [seed, complexity, iterations] = await getPowInfo(
      liteClient,
      Address.parse(giverAddress)
    );

    if (seed === lastMinedSeed) {
      updateBestGivers();
      await delay(200);
      continue;
    }

    let handlers: ChildProcess[] = [];
    
    const mined: Buffer | undefined = await new Promise(
      async (resolve, reject) => {
        let rest = gpus;
        for (let i = 0; i < gpus; i++) {
          const randomName = (await getSecureRandomBytes(8)).toString("hex") + ".boc";
          const path = `bocs/${randomName}`;
          const command = `-g ${i} -F 128 -t ${timeout} ${MINE_TO_WALLET} ${seed} ${complexity} ${iterations} ${giverAddress} ${path}`;

          const procid = spawn(bin, command.split(" "), { stdio: "pipe" });
          handlers.push(procid);

          procid.on("exit", () => {
            let mined: Buffer | undefined = undefined;
            try {
              const exists = fs.existsSync(path);
              if (exists) {
                mined = fs.readFileSync(path);
                resolve(mined);
                lastMinedSeed = seed;
                fs.rmSync(path);
                for (const handle of handlers) {
                  handle.kill("SIGINT");
                }
              }
            } catch (e) {
              console.log("not mined", e);
            } finally {
              if (--rest === 0) {
                resolve(undefined);
              }
            }
          });
        }
      }
    );

    if (!mined) {
      console.log(`${new Date()}: not mined`, seed, i++);
    }
    if (mined) {
      const [newSeed] = await getPowInfo(
        liteClient,
        Address.parse(giverAddress)
      );
      if (newSeed !== seed) {
        console.log("Mined already too late seed");
        continue;
      }
      console.log(`${new Date()}:     mined`, seed, i++);
      void sendMinedBoc(
        giverAddress,
        Cell.fromBoc(mined as Buffer)[0].asSlice().loadRef()
      );
    }
  }
}
main();