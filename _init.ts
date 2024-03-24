import { mnemonicNew, mnemonicToWalletKey } from 'ton-crypto';
import { Wallets } from 'ton3-contracts';
import { ProviderRESTV2 } from 'ton3-providers';
import { BOC, Address, Coins } from 'ton3-core';
import { Buffer } from 'buffer';
import arg from 'arg';
import * as fs from 'fs';

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

const args = arg({
  '--v3r1': String,
  '--to-wallet': String,
});

class TonGetWalletInformation {
  data: {
    ok: boolean;
    result: {
      wallet: boolean;
      balance: number;
      account_state: string;
      wallet_type: string;
      seqno: number;
      last_transaction_id: {
        '@type': string;
        lt: string;
        hash: string;
      };
      wallet_id: number;
    };
  } | undefined;
}

const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// @ts-ignore
const getSeqno = async (address: string): Promise<number | undefined> => {
  try {
    const provider = new ProviderRESTV2(ENDPOINT, { apiKey: API_KEY });
    const client = await provider.client();
    const seqno = (await client.getWalletInformation({
      address: address,
    })) as unknown as TonGetWalletInformation;
    if (seqno && seqno?.data?.ok) {
      if (seqno?.data?.result?.seqno) {
        return Number(seqno.data.result.seqno);
      }
      return 0;
    }
  } catch (e) {
    console.log('---------');
    console.log('TonBlockchainService:getSeqno');
    console.log('---------');
  }

  return undefined;
}

// @ts-ignore
const genHighload = async (v3r1Mnemonic: string[]): Promise<string[] | undefined> => {
  const provider = new ProviderRESTV2(ENDPOINT, { apiKey: API_KEY });
  const client = await provider.client();

  const mnemonic = await mnemonicNew(24);
  const walletKeys = await mnemonicToWalletKey(mnemonic);
  const walletHighload = new Wallets.ContractHighloadWalletV2({
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
  console.log(`  - Private Key: ${Buffer.from(walletKeys.secretKey).toString('hex')}`);
  console.log(`  - Public Key: ${Buffer.from(walletKeys.publicKey).toString('hex')}`);

  const v3r1Keys = await mnemonicToWalletKey(v3r1Mnemonic);
  const v3r1Wallet = new Wallets.ContractWalletV3R0({
    workchain: WORKCHAIN,
    publicKey: v3r1Keys.publicKey,
    subwalletId: 698983191,
  });

  const seqno = await getSeqno(v3r1Wallet.address.toString('base64'));
  if (seqno === undefined) {
    console.log('   ! Fail to get v3r1 seqno');
    return;
  }

  const payment = v3r1Wallet
    .createTransferMessage(
      [
        // @ts-ignore
        {
          destination: new Address(addressHex, {
            workchain: 0,
            bounceable: false,
            testOnly: false,
          }),
          amount: new Coins(0.3, { isNano: false }),
          mode: 3,
        },
      ],
      seqno,
    )
    .sign(v3r1Keys.secretKey);

  console.log(' * Transfer tons for deploy');
  let successV3r1 = false;
  try {
    const data = await client.sendBoc(null, { boc: new BOC([payment]).toString('base64') });
    console.log(` * Transfer tons: ${data.data.ok}`);
    successV3r1 = true;
  } catch (e) {
    // @ts-ignore
    console.log(e?.response?.data ?? e);
    console.log(' * Transfer tons: fail');
    successV3r1 = false;
  }

  if (!successV3r1) {
    console.log('   ! Fail to transfer coins for deploy highload wallet');
    return;
  }

  await sleep(30 * 1_000);
  console.log(' * Init deploy highload wallet');

  const deploy = walletHighload.createDeployMessage().sign(walletKeys.secretKey);

  let success = false;
  try {
    const data = await client.sendBoc(null, { boc: new BOC([deploy]).toString('base64') });
    console.log(` * Deploy result: ${data.data.ok}`);
    success = true;
  } catch (e) {
    // @ts-ignore
    console.log(e?.response?.data ?? e);
    console.log(' * Deploy result: fail');
    success = false;
  }

  if (success) {
    return mnemonic;
  }
};

(async () => {
  if (!args['--v3r1']) {
    console.log(' * No v3r1 mnemonic');
    return;
  }
  if (!args['--to-wallet']) {
    console.log(' * No to wallet address');
    return;
  }

  const v3r1Mnemonic = (args['--v3r1'] as string).split(',');
  if (v3r1Mnemonic?.length !== 24) {
    console.log(' * Invalid v3r1 mnemonic');
    return;
  }

  const toWalletAddress = args['--to-wallet'] as string;
  
  console.log(' * Start deploy highload wallet');
  const hwMnemonic = await genHighload(v3r1Mnemonic);
  if (!hwMnemonic) {
    console.log('   ! Fail to deploy highload wallet');
    return;
  }
  console.log(`  - HW Mnemonic: ${hwMnemonic.join(',')}`);
  console.log(`  - Mine to wallet: ${toWalletAddress}`);

  fs.writeFileSync('./.env', `MINE_TO_WALLET=${toWalletAddress}\nMY_SEED=${hwMnemonic.join(',')}`);
  console.log(' * .env compete');
})();