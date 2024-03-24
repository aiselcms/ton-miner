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
Object.defineProperty(exports, "__esModule", { value: true });
const ton_crypto_1 = require("ton-crypto");
const ton3_contracts_1 = require("ton3-contracts");
const ton3_providers_1 = require("ton3-providers");
const ton3_core_1 = require("ton3-core");
const buffer_1 = require("buffer");
const arg_1 = __importDefault(require("arg"));
const fs = __importStar(require("fs"));
/*

Мнемоника: bus,sting,cook,start,pause,moon,there,proof,fancy,agent,beauty,scare,disorder,report,apart,kid,unhappy,indicate,pet,wealth,auction,vehicle,moment,keen
Адрес RAW: 0:f723ba6ec60ff1e61b5f8d6ec61a98bede08bf2b4c78509470745c8d218422b9
Адрес HEX: UQD3I7puxg_x5htfjW7GGpi-3gi_K0x4UJRwdFyNIYQiuTY6
Private Key: d7fca067fed734e1b9e0cf45607fb20c024ebbcf4df3e4348a2e1b3ec990b406c85bd0a71f6c0bb943bb58905b96a0ebd3cc9f560162e05f8efb165038828142
Public Key: c85bd0a71f6c0bb943bb58905b96a0ebd3cc9f560162e05f8efb165038828142


tsc && node _init.js --v3r1 bus,sting,cook,start,pause,moon,there,proof,fancy,agent,beauty,scare,disorder,report,apart,kid,unhappy,indicate,pet,wealth,auction,vehicle,moment,keen --to-wallet EQAS8m9wnaknW3n7Rxhj2yjWxoekpRAIoeCzgCcX0ScCG2K0

 */
const WORKCHAIN = 0;
const ENDPOINT = 'https://toncenter.com/api/v2';
const API_KEY = 'a837b6f73485567abc97e431504ae167bc52b3c5f05733d17f9fa6cbc224c514';
const args = (0, arg_1.default)({
    '--v3r1': String,
    '--to-wallet': String,
});
class TonGetWalletInformation {
}
const sleep = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => setTimeout(resolve, ms));
});
// @ts-ignore
const getSeqno = (address) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const provider = new ton3_providers_1.ProviderRESTV2(ENDPOINT, { apiKey: API_KEY });
        const client = yield provider.client();
        const seqno = (yield client.getWalletInformation({
            address: address,
        }));
        if (seqno && ((_a = seqno === null || seqno === void 0 ? void 0 : seqno.data) === null || _a === void 0 ? void 0 : _a.ok)) {
            if ((_c = (_b = seqno === null || seqno === void 0 ? void 0 : seqno.data) === null || _b === void 0 ? void 0 : _b.result) === null || _c === void 0 ? void 0 : _c.seqno) {
                return Number(seqno.data.result.seqno);
            }
            return 0;
        }
    }
    catch (e) {
        console.log('---------');
        console.log('TonBlockchainService:getSeqno');
        console.log('---------');
    }
    return undefined;
});
// @ts-ignore
const genHighload = (v3r1Mnemonic) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e, _f, _g;
    const provider = new ton3_providers_1.ProviderRESTV2(ENDPOINT, { apiKey: API_KEY });
    const client = yield provider.client();
    const mnemonic = yield (0, ton_crypto_1.mnemonicNew)(24);
    const walletKeys = yield (0, ton_crypto_1.mnemonicToWalletKey)(mnemonic);
    const walletHighload = new ton3_contracts_1.Wallets.ContractHighloadWalletV2({
        workchain: WORKCHAIN,
        publicKey: walletKeys.publicKey,
        subwalletId: 698983191,
    });
    const addressRaw = walletHighload.address.toString('raw', {
        workchain: WORKCHAIN,
        testOnly: false,
        urlSafe: true,
        bounceable: false,
    });
    const addressHex = walletHighload.address.toString('base64', {
        workchain: WORKCHAIN,
        testOnly: false,
        urlSafe: true,
        bounceable: false,
    });
    console.log(`  - Mnemonic: ${mnemonic.join(',')}`);
    console.log(`  - Address RAW: ${addressRaw.toLowerCase()}`);
    console.log(`  - Address HEX: ${addressHex}`);
    console.log(`  - Private Key: ${buffer_1.Buffer.from(walletKeys.secretKey).toString('hex')}`);
    console.log(`  - Public Key: ${buffer_1.Buffer.from(walletKeys.publicKey).toString('hex')}`);
    const v3r1Keys = yield (0, ton_crypto_1.mnemonicToWalletKey)(v3r1Mnemonic);
    const v3r1Wallet = new ton3_contracts_1.Wallets.ContractWalletV3R0({
        workchain: WORKCHAIN,
        publicKey: v3r1Keys.publicKey,
        subwalletId: 698983191,
    });
    const seqno = yield getSeqno(v3r1Wallet.address.toString('base64'));
    if (seqno === undefined) {
        console.log('   ! Fail to get v3r1 seqno');
        return;
    }
    const payment = v3r1Wallet
        .createTransferMessage([
        // @ts-ignore
        {
            destination: new ton3_core_1.Address(addressHex, {
                workchain: 0,
                bounceable: false,
                testOnly: false,
            }),
            amount: new ton3_core_1.Coins(0.3, { isNano: false }),
            mode: 3,
        },
    ], seqno)
        .sign(v3r1Keys.secretKey);
    console.log(' * Transfer tons for deploy');
    let successV3r1 = false;
    try {
        const data = yield client.sendBoc(null, { boc: new ton3_core_1.BOC([payment]).toString('base64') });
        console.log(` * Transfer tons: ${data.data.ok}`);
        successV3r1 = true;
    }
    catch (e) {
        // @ts-ignore
        console.log((_e = (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.data) !== null && _e !== void 0 ? _e : e);
        console.log(' * Transfer tons: fail');
        successV3r1 = false;
    }
    if (!successV3r1) {
        console.log('   ! Fail to transfer coins for deploy highload wallet');
        return;
    }
    yield sleep(30 * 1000);
    console.log(' * Init deploy highload wallet');
    const deploy = walletHighload.createDeployMessage().sign(walletKeys.secretKey);
    let success = false;
    try {
        const data = yield client.sendBoc(null, { boc: new ton3_core_1.BOC([deploy]).toString('base64') });
        console.log(` * Deploy result: ${data.data.ok}`);
        success = true;
    }
    catch (e) {
        // @ts-ignore
        console.log((_g = (_f = e === null || e === void 0 ? void 0 : e.response) === null || _f === void 0 ? void 0 : _f.data) !== null && _g !== void 0 ? _g : e);
        console.log(' * Deploy result: fail');
        success = false;
    }
    if (success) {
        return mnemonic;
    }
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    if (!args['--v3r1']) {
        console.log(' * No v3r1 mnemonic');
        return;
    }
    if (!args['--to-wallet']) {
        console.log(' * No to wallet address');
        return;
    }
    const v3r1Mnemonic = args['--v3r1'].split(',');
    if ((v3r1Mnemonic === null || v3r1Mnemonic === void 0 ? void 0 : v3r1Mnemonic.length) !== 24) {
        console.log(' * Invalid v3r1 mnemonic');
        return;
    }
    const toWalletAddress = args['--to-wallet'];
    console.log(' * Start deploy highload wallet');
    const hwMnemonic = yield genHighload(v3r1Mnemonic);
    if (!hwMnemonic) {
        console.log('   ! Fail to deploy highload wallet');
        return;
    }
    console.log(`  - HW Mnemonic: ${hwMnemonic.join(',')}`);
    console.log(`  - Mine to wallet: ${toWalletAddress}`);
    fs.writeFileSync('./.env', `MINE_TO_WALLET=${toWalletAddress}\nMY_SEED=${hwMnemonic.join(',')}`);
    console.log(' * .env compete');
}))();
