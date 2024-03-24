"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const arg_1 = __importDefault(require("arg"));
const _givers_1 = require("./_givers");
const ton_1 = require("@ton/ton");
const ton_lite_client_1 = require("ton-lite-client");
const core_1 = require("@ton/core");
const crypto_1 = require("@ton/crypto");
const child_process_1 = require("child_process");
const ton3_contracts_1 = require("ton3-contracts");
const ton3 = __importStar(require("ton3-core"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const ton3_core_1 = require("ton3-core");
const dotenv_1 = __importDefault(require("dotenv"));
/*
tsc && node _mine.js --bin ./pow-miner-cuda -c https://static.ton-rocket.com/private-config.json --givers 100 --gpu-count 1
 */
dotenv_1.default.config({ path: '.env' });
const MINE_TO_WALLET = process.env.MINE_TO_WALLET;
const MY_SEED = process.env.MY_SEED;
const args = (0, arg_1.default)({
    '--givers': Number,
    '--bin': String,
    '--gpu-count': Number,
    '--timeout': Number,
    '-c': String, // blockchain config
});
/* Выбор гиверов */
let givers = _givers_1.givers10000;
if (args['--givers']) {
    const val = args['--givers'];
    const allowed = [100, 1000, 10000];
    if (!allowed.includes(val)) {
        throw new Error('Invalid --givers argument');
    }
    switch (val) {
        case 100:
            givers = _givers_1.givers100;
            console.log('Using givers 100');
            break;
        case 1000:
            givers = _givers_1.givers1000;
            console.log('Using givers 1 000');
            break;
        case 10000:
            givers = _givers_1.givers10000;
            console.log('Using givers 10 000');
            break;
    }
}
else {
    console.log('Using givers 10 000');
}
/* Выбор бинарника */
let bin = '.\\pow-miner-cuda.exe';
if (args['--bin']) {
    const argBin = args['--bin'];
    if (argBin === 'cuda') {
        bin = '.\\pow-miner-cuda.exe';
    }
    else if (argBin === 'opencl' || argBin === 'amd') {
        bin = '.\\pow-miner-opencl.exe';
    }
    else {
        bin = argBin;
    }
}
console.log('Using bin', bin);
/* Количества GPU и таймаут */
const gpus = args['--gpu-count'] || 1;
const timeout = (_a = args['--timeout']) !== null && _a !== void 0 ? _a : 5;
console.log('Using GPUs count', gpus);
console.log('Using timeout', timeout);
const delay = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
});
let bestGiver = { address: '', coins: 0 };
const updateBestGivers = () => {
    const giver = givers[Math.floor(Math.random() * givers.length)];
    bestGiver = {
        address: giver.address,
        coins: giver.reward,
    };
};
const intToIP = (int) => {
    const part1 = int & 255;
    const part2 = (int >> 8) & 255;
    const part3 = (int >> 16) & 255;
    const part4 = (int >> 24) & 255;
    return `${part4}.${part3}.${part2}.${part1}`;
};
const callForSuccess = (toCall, attempts = 50, delayMs = 100) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof toCall !== 'function') {
        throw new Error('unknown input');
    }
    let i = 0;
    let lastError;
    while (i < attempts) {
        try {
            return yield toCall();
        }
        catch (err) {
            lastError = err;
            i++;
            yield delay(delayMs);
        }
    }
    console.log('error after attempts', i);
    throw lastError;
});
let lc = undefined;
let createLiteClient;
const getLiteClient = (_configUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (lc) {
        return lc;
    }
    if (!createLiteClient) {
        createLiteClient = (() => __awaiter(void 0, void 0, void 0, function* () {
            const { data } = yield (0, axios_1.default)(_configUrl);
            const liteServers = data.liteservers;
            const engines = [];
            for (const server of liteServers) {
                const ls = server;
                engines.push(new ton_lite_client_1.LiteSingleEngine({
                    host: `tcp://${intToIP(ls.ip)}:${ls.port}`,
                    publicKey: Buffer.from(ls.id.key, 'base64'),
                }));
            }
            const engine = new ton_lite_client_1.LiteRoundRobinEngine(engines);
            lc = new ton_lite_client_1.LiteClient({
                engine,
                batchSize: 1,
            });
        }))();
    }
    yield createLiteClient;
    return lc;
});
const getPowInfo = (liteClient, address) => __awaiter(void 0, void 0, void 0, function* () {
    if (liteClient instanceof ton_1.TonClient4) {
        const lastInfo = yield callForSuccess(() => liteClient.getLastBlock());
        const powInfo = yield callForSuccess(() => liteClient.runMethod(lastInfo.last.seqno, address, "get_mining_status", []));
        const reader = new core_1.TupleReader(powInfo.result);
        const complexity = reader.readBigNumber();
        let iterations = reader.readBigNumber();
        if (iterations == BigInt(0)) {
            iterations = BigInt(10);
        }
        const seed = reader.readBigNumber();
        return [seed, complexity, iterations];
    }
    else if (liteClient instanceof ton_lite_client_1.LiteClient) {
        const lastInfo = yield liteClient.getMasterchainInfo();
        const powInfo = yield liteClient.runMethod(address, "get_mining_status", Buffer.from([]), lastInfo.last);
        const powStack = core_1.Cell.fromBase64(powInfo.result);
        const stack = (0, core_1.parseTuple)(powStack);
        const reader = new core_1.TupleReader(stack);
        const complexity = reader.readBigNumber();
        let iterations = reader.readBigNumber();
        if (iterations == BigInt(0)) {
            iterations = BigInt(10);
        }
        const seed = reader.readBigNumber();
        return [seed, complexity, iterations];
    }
    throw new Error("invalid client");
});
const sendMinedBoc = (giverAddress, boc) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const walletKeys = yield (0, crypto_1.mnemonicToWalletKey)(MY_SEED.split(','));
        const walletHighload = new ton3_contracts_1.Wallets.ContractHighloadWalletV2({
            workchain: 0,
            publicKey: walletKeys.publicKey,
            subwalletId: 698983191,
        });
        const transfers = [];
        transfers.push({
            destination: new ton3.Address(giverAddress),
            amount: new ton3.Coins('0.05'),
            body: ton3_core_1.BOC.from(boc.toString()).root[0],
            mode: 3
        });
        const payments = walletHighload
            .createTransferMessage(transfers)
            .sign(walletKeys.secretKey);
        const liteClient = yield getLiteClient((_b = args['-c']) !== null && _b !== void 0 ? _b : 'https://ton-blockchain.github.io/global.config.json');
        try {
            yield liteClient.sendMessage(Buffer.from(new ton3_core_1.BOC([payments]).toBytes()));
        }
        catch (e) {
            console.log(e);
        }
    }
    catch (e) { }
});
let go = true;
let i = 0;
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    console.log('Using LiteServer API');
    const liteClient = yield getLiteClient((_c = args['-c']) !== null && _c !== void 0 ? _c : 'https://ton-blockchain.github.io/global.config.json');
    while (go) {
        updateBestGivers();
        const giverAddress = bestGiver.address;
        const [seed, complexity, iterations] = yield getPowInfo(liteClient, core_1.Address.parse(giverAddress));
        for (let gpuId = 0; gpuId < gpus; gpuId++) {
            const randomName = (yield (0, crypto_1.getSecureRandomBytes)(8)).toString('hex') + '.boc';
            const path = `bocs/${randomName}`;
            const command = `${bin} -g ${gpuId} -F 128 -t ${timeout} ${MINE_TO_WALLET} ${seed} ${complexity} ${iterations} ${giverAddress} ${path}`;
            try {
                (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' }); // the default is 'buffer'
            }
            catch (e) {
                console.log(e);
            }
            let mined = undefined;
            try {
                mined = fs_1.default.readFileSync(path);
                fs_1.default.rmSync(path);
            }
            catch (e) { }
            if (!mined) {
                console.log(`${new Date()}: not mined`, seed, i++);
            }
            else {
                const [newSeed] = yield getPowInfo(liteClient, core_1.Address.parse(giverAddress));
                if (newSeed !== seed) {
                    console.log('Mined already too late seed');
                    continue;
                }
                console.log(`${new Date()}:  mined`, seed, i++);
                void sendMinedBoc(giverAddress, core_1.Cell.fromBoc(mined)[0].asSlice().loadRef());
                break;
            }
        }
    }
});
main();
