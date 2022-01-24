import { useState, useEffect } from 'react';
import useNotify from './notify'
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@project-serum/anchor";
import {AccountLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Transaction,
  ConfirmOptions,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { programs } from '@metaplex/js';
import axios from "axios";
import moment from 'moment';
import {WalletConnect} from '../wallet';
import './work.css';
import { IDL } from './idl';
import Countdown from 'antd/lib/statistic/Countdown';

const { metadata: { Metadata } } = programs;
const confirmOption : ConfirmOptions = {
  commitment : 'finalized',
  preflightCommitment : 'finalized',
  skipPreflight : false
}

let conn = new anchor.web3.Connection("https://sparkling-dry-thunder.solana-devnet.quiknode.pro/08975c8cb3c5209785a819fc9a3b2b537d3ba604/");
const programId = new PublicKey('EgNe8cAx8MhDBdKmxsinNgteNRFQNPG6u9jTDXC3dBEB');
const rewardMint = new PublicKey('6KpeU8HUxb7SAJDAKjwnLYmRCMVdZGib9spxWqYZNT3k');
const idl = IDL as anchor.Idl;

// Constants
const STAKE_LEGEND_DATA_SIZE = 8 + 1 + 32 + 32 + 32 + 8 + 8 + 8;
const STAKE_TOKEN_DATA_SIZE = 8 + 1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8;
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export default function Stake() {
	const wallet = useAnchorWallet();
	const notify = useNotify();
  const [pool, setPOOL] = useState<PublicKey>(new PublicKey('GVGj1FrfcyY8s6GMDWqfVZTt5StExgC8xV6KUaMqoM3h'));
  const [isWorking, setIsWorking] = useState(false);
  const [rewardLegendAmount, setRewardLegendAmount] = useState(10);
  const [periodLegend, setPeirodLegend] = useState(1 * 60);
  const [stakeLegendSymbol, setStakeLegendSymbol] = useState("Gorilla");
  const [stakeAmount, setStakeAmount] = useState(100);
  const [depositAmount, setDepositAmount] = useState(100);
  const [periodToken, setPeriodToken] = useState(5 * 60);
  const [stakeTokenApr, setStakeTokenApr] = useState(30);
  const [stakedTokens, setStakedTokens] = useState<Array<any>>([]);
  const [nfts, setNfts] = useState<Array<any>>([]);
  const [stakedNfts, setStakedNfts] = useState<Array<any>>([]);
  const [poolData, setPoolData] = useState({
    owner: "",
    rand: "",
    rewardMint: "",
    rewardAccount: "",
    rewardTokenAmount: 0,
    periodToken: 0,
    stakeTokenApr: 0,
    rewardLegendAmount: 0,
    periodLegend: 0,
    stakeLegendSymbol: "",
  });

  async function getTokenBalance(tokenAccount : PublicKey) {
    try {
      const amount = (await conn.getTokenAccountBalance(tokenAccount)).value.uiAmount;
      return amount? amount : 0;
    } catch (e) {
      console.log(e);
    }
    return 0;
  }

  const createAssociatedTokenAccountInstruction = (
    associatedTokenAddress: anchor.web3.PublicKey,
    payer: anchor.web3.PublicKey,
    walletAddress: anchor.web3.PublicKey,
    splTokenMintAddress: anchor.web3.PublicKey
      ) => {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
      { pubkey: walletAddress, isSigner: false, isWritable: false },
      { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
      {
        pubkey: anchor.web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ];
    return new anchor.web3.TransactionInstruction({
      keys,
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.from([]),
    });
  }
  
  const getTokenWallet = async (
    wallet: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey
      ) => {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )[0];
  };

  const getMetadata = async (
    mint: anchor.web3.PublicKey
      ): Promise<anchor.web3.PublicKey> => {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  };
  
  async function sendTransaction(transaction : Transaction, signers : Keypair[]) {
    try{
      // @ts-ignore
      transaction.feePayer = wallet.publicKey
      transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
      // @ts-ignore
      await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
      if(signers.length != 0)
        await transaction.partialSign(...signers);
        // @ts-ignore
      const signedTransaction = await wallet.signTransaction(transaction);
      let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
      await conn.confirmTransaction(hash);
      notify('success', 'Success!');
      return true;
    } catch(e) {
      console.log(e)
      notify('error', 'Failed Instruction!');
      return false;
    }
  }
  
  async function initPool(rewardLegendAmount : number, periodLegend : number, stakeLegendSymbol: string, periodToken: number, stakeTokenApr: number) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl, programId, provider);
    let randomPubkey = Keypair.generate().publicKey;
    let [pool, bump] = await PublicKey.findProgramAddress([randomPubkey.toBuffer()], programId);
    let rewardAccount = await getTokenWallet(pool, rewardMint);
    let transaction = new Transaction();
    // @ts-ignore
    transaction.add(createAssociatedTokenAccountInstruction(rewardAccount, wallet.publicKey, pool, rewardMint));
    transaction.add(
      await program.instruction.initPool(
        new anchor.BN(bump),
        new anchor.BN(rewardLegendAmount),
        new anchor.BN(periodLegend),
        stakeLegendSymbol,
        new anchor.BN(periodToken),
        new anchor.BN(stakeTokenApr),
        {
          accounts:{
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            rand : randomPubkey,
            rewardMint : rewardMint,
            rewardAccount : rewardAccount,
            // @ts-ignore
            mintAuthority : wallet.publicKey,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
          }
        }
      )
    );
    await sendTransaction(transaction, []);
    console.log(pool.toBase58());
    setPOOL(pool);
  }

  async function updatePool(rewardLegendAmount : number, periodLegend : number, stakeLegendSymbol: string, periodToken: number, stakeTokenApr: number) {
    if (poolData.owner != wallet?.publicKey.toBase58()) {
      notify('error', 'You are not owner of Pool.');
      return;
    }
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl, programId, provider);
    let transaction = new Transaction();
    transaction.add(
      await program.instruction.updatePool(
        new anchor.BN(rewardLegendAmount),
        new anchor.BN(periodLegend),
        stakeLegendSymbol,
        {
          accounts:{
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
          }
        }
      )
    );
    await sendTransaction(transaction, []);
  }

  async function stakeLegend(nftMint : PublicKey){
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId,provider);
    const stakeData = Keypair.generate();
    const metadata = await getMetadata(nftMint);
    // @ts-ignore
    const sourceNftAccount = await getTokenWallet(wallet.publicKey, nftMint);
    const destNftAccount = await getTokenWallet(pool, nftMint);
    let transaction = new Transaction();
    let signers : Keypair[] = [];
    signers.push(stakeData);
    if((await conn.getAccountInfo(destNftAccount)) == null)
      // @ts-ignore
      transaction.add(createAssociatedTokenAccountInstruction(destNftAccount, wallet.publicKey, pool, nftMint));
    transaction.add(
      await program.instruction.stakeLegend({
        accounts: {
          // @ts-ignore
          owner : wallet.publicKey,
          pool : pool,
          stakeData : stakeData.publicKey,
          nftMint : nftMint,
          metadata : metadata,
          sourceNftAccount : sourceNftAccount,
          destNftAccount : destNftAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : anchor.web3.SystemProgram.programId,
          clock : SYSVAR_CLOCK_PUBKEY
        }
      })
    );
    await sendTransaction(transaction, signers);
    await refresh();
  }

  async function unstakeLegend(stakeData : PublicKey) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId, provider);
    let stakedNft = await program.account.stakeLegendData.fetch(stakeData);
    let account = await conn.getAccountInfo(stakedNft.account);
    let mint = new PublicKey(AccountLayout.decode(account!.data).mint);
    // @ts-ignore
    const destNftAccount = await getTokenWallet(wallet.publicKey, mint);
    let transaction = new Transaction();
  
    transaction.add(
      await program.instruction.unstakeLegend({
        accounts:{
          // @ts-ignore
          owner : wallet.publicKey,
          pool : pool,
          stakeData : stakeData,
          sourceNftAccount : stakedNft.account,
          destNftAccount : destNftAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          clock : SYSVAR_CLOCK_PUBKEY
        }
      })
    );
    await sendTransaction(transaction,[]);
    await refresh();
  }

  async function claimLegend(stakeData : PublicKey){
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId,provider);
    // @ts-ignore
    let destRewardAccount = await getTokenWallet(wallet.publicKey, rewardMint);
    let transaction = new Transaction();
    if((await conn.getAccountInfo(destRewardAccount)) == null)
      // @ts-ignore
      transaction.add(createAssociatedTokenAccountInstruction(destRewardAccount, wallet.publicKey, wallet.publicKey, rewardMint));
    transaction.add(
      await program.instruction.claimLegend({
        accounts:{
          // @ts-ignore
          owner : wallet.publicKey,
          pool : pool,
          stakeData : stakeData,
          rewardMint : rewardMint,
          destRewardAccount : destRewardAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          clock : SYSVAR_CLOCK_PUBKEY,
        }
      })
    );
    await sendTransaction(transaction,[]);
    await refresh();
  }

  async function stakeToken(amount: number){
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl, programId, provider);
    const stakeData = Keypair.generate();
    // @ts-ignore
    const sourceRewardAccount = await getTokenWallet(wallet.publicKey, rewardMint);
    const destRewardAccount = await getTokenWallet(pool, rewardMint);
    let transaction = new Transaction();
    let signers : Keypair[] = [];
    signers.push(stakeData);
    if((await conn.getAccountInfo(sourceRewardAccount)) == null)
      // @ts-ignore
      transaction.add(createAssociatedTokenAccountInstruction(sourceRewardAccount, wallet.publicKey, wallet.publicKey, rewardMint));
    transaction.add(
      await program.instruction.stakeToken(
        new anchor.BN(amount),
        {
          accounts: {
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            stakeData : stakeData.publicKey,
            sourceRewardAccount : sourceRewardAccount,
            destRewardAccount : destRewardAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        }
      )
    );
    await sendTransaction(transaction, signers);
    await refresh();
  }

  async function unstakeToken(stakeData : PublicKey){
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl, programId, provider);
    const sourceRewardAccount = await getTokenWallet(pool, rewardMint);
    // @ts-ignore
    const destRewardAccount = await getTokenWallet(wallet.publicKey, rewardMint);
    let transaction = new Transaction();
    transaction.add(
      await program.instruction.unstakeToken(
        {
          accounts: {
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            stakeData : stakeData,
            sourceRewardAccount : sourceRewardAccount,
            destRewardAccount : destRewardAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        }
      )
    );
    await sendTransaction(transaction, []);
    await refresh();
  }

  async function depositToken(stakeData: PublicKey, amount: number) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl, programId, provider);
    // @ts-ignore
    const sourceRewardAccount = await getTokenWallet(wallet.publicKey, rewardMint);
    const destRewardAccount = await getTokenWallet(pool, rewardMint);
    let transaction = new Transaction();
    transaction.add(
      await program.instruction.depositToken(
        new anchor.BN(amount),
        {
          accounts: {
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            stakeData : stakeData,
            sourceRewardAccount : sourceRewardAccount,
            destRewardAccount : destRewardAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        }
      )
    );
    await sendTransaction(transaction, []);
    await refresh();
  }

  async function claimToken(stakeData : PublicKey) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId,provider);
    // @ts-ignore
    const destRewardAccount = await getTokenWallet(wallet.publicKey, rewardMint);
    let transaction = new Transaction()
  
    transaction.add(
      await program.instruction.claimToken(
        {
          accounts:{
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            stakeData : stakeData,
            rewardMint : rewardMint,
            destRewardAccount : destRewardAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        }
      )
    );
    await sendTransaction(transaction, []);
    await refresh();
  }
  
  async function getPoolData() {
    let poolData = {
      owner : "Not init",
      rand : "Not init",
      rewardMint : "Not init",
      rewardAccount : "Not init",
      rewardTokenAmount : 0,
      periodToken : 0,
      stakeTokenApr : 0,
      rewardLegendAmount : 0,
      periodLegend : 0,
      stakeLegendSymbol : "Not init"
    };
    try {
      const poolTokenAcount = await getTokenWallet(pool, rewardMint);
      const tokenAmount = await getTokenBalance(poolTokenAcount);
      let provider = new anchor.Provider(conn, wallet as any, confirmOption);
      const program = new anchor.Program(idl, programId, provider);
      let poolFetch = await program.account.pool.fetch(pool);
      poolData = {
        owner : poolFetch.owner.toBase58(),
        rand : poolFetch.rand.toBase58(),
        rewardMint : poolFetch.rewardMint.toBase58(),
        rewardAccount : poolTokenAcount.toBase58(),
        rewardTokenAmount : tokenAmount,
        periodToken : poolFetch.periodToken.toNumber(),
        stakeTokenApr : poolFetch.stakeTokenApr.toNumber(),
        rewardLegendAmount : poolFetch.rewardLegendAmount.toNumber(),
        periodLegend : poolFetch.periodLegend.toNumber(),
        stakeLegendSymbol : poolFetch.stakeLegendSymbol
      };
    } catch (e) {
      console.log(e);
    }
    setPoolData(poolData);
    return poolData;
  }

  async function getNftsForOwner(poolData: any) {
    const allTokens: any = [];
    // @ts-ignore
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(wallet?.publicKey, {
      programId: TOKEN_PROGRAM_ID
    });
  
    for (let index = 0; index < tokenAccounts.value.length; index++) {
      try{
        const tokenAccount = tokenAccounts.value[index];
        const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
  
        if (tokenAmount.amount == "1" && tokenAmount.decimals == "0") {
          let nftMint = new PublicKey(tokenAccount.account.data.parsed.info.mint)
          let [pda] = await anchor.web3.PublicKey.findProgramAddress([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            nftMint.toBuffer(),
          ], TOKEN_METADATA_PROGRAM_ID);
          const accountInfo: any = await conn.getParsedAccountInfo(pda);
          // @ts-ignore
          let metadata : any = new Metadata(wallet?.publicKey.toString(), accountInfo.value);
          const { data }: any = await axios.get(metadata.data.data.uri);
          if (metadata.data.data.symbol == poolData.stakeLegendSymbol) {
            const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0]) }
            allTokens.push({address : nftMint, ...entireData })
          }
        }
      } catch(e) {
        console.log(e);
        continue;
      }
    }
    setNfts(allTokens);
    return allTokens;
  }

  async function getStakedNftsForOwner(poolData: any) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId, provider);
    const allTokens: any = [];
    let resp = await conn.getProgramAccounts(programId,{
      dataSlice: {length: 0, offset: 0},
      // @ts-ignore
      filters: [{dataSize: STAKE_LEGEND_DATA_SIZE},{memcmp:{offset:9, bytes:wallet?.publicKey.toBase58()}},{memcmp:{offset:41, bytes:pool.toBase58()}}]
    })
    for(let nftAccount of resp){
      let stakedNft = await program.account.stakeLegendData.fetch(nftAccount.pubkey)
      if(stakedNft.unstaked) continue;
      let number = Math.floor(((moment().unix() - stakedNft.stakeTime.toNumber()) / poolData.periodLegend));
      let claimable = poolData.rewardLegendAmount * (number - stakedNft.withdrawnNumber.toNumber());
      if (claimable < 0) claimable = 0;
      let account = await conn.getAccountInfo(stakedNft.account)
      let mint = new PublicKey(AccountLayout.decode(account!.data).mint)
      let pda= await getMetadata(mint)
      const accountInfo: any = await conn.getParsedAccountInfo(pda);
      // @ts-ignore
      let metadata : any = new Metadata(wallet?.publicKey.toString(), accountInfo.value);
      const { data }: any = await axios.get(metadata.data.data.uri)
      const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0])}
      allTokens.push({
        withdrawnNumber : stakedNft.withdrawnNumber,
        stakeTime : stakedNft.stakeTime.toNumber(),
        stakeData : nftAccount.pubkey,
        address : mint,
        claimable,
        ...entireData,
      })
    }
    setStakedNfts(allTokens);
    return allTokens;
  }

  async function getStakedTokenForOwner(poolData: any) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId, provider);
    let stakeDatas = await conn.getProgramAccounts(programId, {
      dataSlice: {length: 0, offset: 0},
      // @ts-ignore
      filters: [{dataSize: STAKE_TOKEN_DATA_SIZE},{memcmp: {offset: 9, bytes: wallet.publicKey.toBase58()}}, {memcmp: {offset: 41, bytes: pool.toBase58()}}]
    });
    let stakes = [];
    for (let stakeData of stakeDatas) {
      let stakeToken = await program.account.stakeTokenData.fetch(stakeData.pubkey);
      if (stakeToken.unstaked) continue;

      let accessible = true;
      let base_time;
      if (stakeToken.claimTime.toNumber() > 0 || stakeToken.depositTime.toNumber() > 0) {
        if (stakeToken.claimTime.toNumber() > stakeToken.depositTime.toNumber()) {
            base_time = stakeToken.claimTime.toNumber();
        } else {
            base_time = stakeToken.depositTime.toNumber();
        }
      } else {
        base_time = stakeToken.stakeTime.toNumber();
      }
      let number = Math.floor(((moment().unix() - base_time) / poolData.periodLegend));
      if (poolData.periodToken > (number * poolData.periodLegend)) {
          accessible = false;
      }
      let timeGap = poolData.periodToken - (number * poolData.periodLegend);
      if (timeGap < 0) timeGap = 0;
      let claimable = (Math.floor((stakeToken.stakedAmount.toNumber() * (poolData.stakeTokenApr.toNumber() / 100)))) * number;
      claimable += stakeToken.pastRewardAmount.toNumber();
      if (claimable < 0) claimable = 0;
      const cooldown = moment().unix() + timeGap;
      let data = {
        stakeData: stakeToken.pubkey,
        claimable: claimable,
        accessible,
        cooldown
      };
      stakes.push(data);
    }
    setStakedTokens(stakes);
    return stakes;
  }

  async function refresh() {
    const poolData = await getPoolData();
    await getNftsForOwner(poolData);
    await getStakedNftsForOwner(poolData);
    await getStakedTokenForOwner(poolData);
  }

	useEffect(() => {
    (async () => {
      if (wallet && wallet.publicKey) {
        setIsWorking(true);
        refresh();
        setIsWorking(false);
      }
    })();
  }, [wallet]);

	return <div className="mother-container">
    <div className="d-flex justify-content-end p-2">
      <WalletConnect />
    </div>
    {wallet ?
    <div className="container-fluid mt-4">
      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="input-group">
            <div className="input-group-prepend">
              <span className="input-group-text">Reward Amount/Unit Period</span>
            </div>
            <input name="rewardLegendAmount"  type="number" className="form-control" onChange={(event)=>{setRewardLegendAmount(Number(event.target.value))}} value={rewardLegendAmount}/>
          </div>
        </div>
        <div className="col-lg-2">
          <div className="input-group">
            <div className="input-group-prepend">
              <span className="input-group-text">Unit Period(s)</span>
            </div>
            <input name="periodLegend"  type="number" className="form-control" onChange={(event)=>{setPeirodLegend(Number(event.target.value))}} value={periodLegend}/>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="input-group">
          <div className="input-group-prepend">
              <span className="input-group-text">Legend Symbol</span>
            </div>
            <input name="stakeLegendSymbol"  type="text" className="form-control" onChange={(event)=>{setStakeLegendSymbol(event.target.value)}} value={stakeLegendSymbol}/>
          </div>
        </div>
        <div className="col-lg-2">
          <div className="input-group">
          <div className="input-group-prepend">
              <span className="input-group-text">Cooldown(s)</span>
            </div>
            <input name="tokenPeriod"  type="number" className="form-control" onChange={(event)=>{setPeriodToken(Number(event.target.value))}} value={periodToken}/>
          </div>
        </div>
        <div className="col-lg-2">
          <div className="input-group">
          <div className="input-group-prepend">
              <span className="input-group-text">APR(%)</span>
            </div>
            <input name="stakeTokenApr"  type="number" className="form-control" onChange={(event)=>{setStakeTokenApr(Number(event.target.value))}} value={stakeTokenApr}/>
          </div>
        </div>
        
      </div>

      <div className="row mb-3">
        <div className="col-lg-3">
          <button type="button" className="btn btn-primary m-1" onClick={async () => {
            setIsWorking(true);
            await initPool(rewardLegendAmount, periodLegend, stakeLegendSymbol, periodToken, stakeTokenApr);
            setIsWorking(false);
          }}>Create Pool</button>
          <button type="button" className="btn btn-secondary m-1" onClick={async () => {
            setIsWorking(true);
            await updatePool(rewardLegendAmount, periodLegend, stakeLegendSymbol, periodToken, stakeTokenApr);
            setIsWorking(false);
          }}>Update Pool</button>
        </div>
      </div>

      <hr />

      <div className="row mb-3">
        <h4>Pool Info</h4>
        <h5>{"Owner: " + poolData.owner}</h5>
        <h5>{"Token Mint: " + poolData.rewardMint}</h5>
        <h5>{"Token Account: " + poolData.rewardAccount}</h5>
        <h5>{"Token Amount: " + poolData.rewardTokenAmount}</h5>
        <h5>{"Cooldown" + poolData.periodToken}s</h5>
        <h5>{"APR" + poolData.stakeTokenApr}%</h5>
        <h5>{"Legend Symbol: " + poolData.stakeLegendSymbol}</h5>
        <h5>{"Unit Period: " + poolData.periodLegend}s</h5>
        <h5>{"Reward Amount/Unit: " + poolData.rewardLegendAmount}</h5>
      </div>

      <hr />

      <div className="row">
        <div className="col-lg-6">
          <h4>Your Wallet NFT</h4>
          <div className="row">
          {
            nfts.map((nft, idx)=>{
              return <div className="card m-3" key={idx} style={{"width" : "250px"}}>
                <img className="card-img-top" src={nft.image} alt="Image Error"/>
                <div className="card-img-overlay">
                  <h4>{nft.name}</h4>
                  <button type="button" className="btn btn-success" onClick={async ()=>{
                    setIsWorking(true);
                    await stakeLegend(nft.address);
                    setIsWorking(false);
                  }}>Stake</button>
                </div>
              </div>
            })
          }
          </div>
        </div>
        <div className="col-lg-6">
          <h4>Your Staked NFT</h4>
          <div className="row">
          {
            stakedNfts.map((nft, idx)=>{
              return <div className="card m-3" key={idx} style={{"width" : "250px"}}>
                <img className="card-img-top" src={nft.image} alt="Image Error"/>
                <div className="card-img-overlay">
                  <h4>{nft.name}</h4>
                  <h4>Claimable: {nft.claimable}</h4>
                  <button type="button" className="btn btn-danger m-1" onClick={async ()=>{
                    setIsWorking(true);
                    await unstakeLegend(nft.stakeData);
                    setIsWorking(false);
                  }}>Unstake</button>
                  {
                    (nft.claimable > 0) && 
                    <button type="button" className="btn btn-warning m-1" onClick={async ()=>{
                      setIsWorking(true);
                      await claimLegend(nft.stakeData);
                      setIsWorking(false);
                    }}>Claim</button>
                  }
                </div>
              </div>
            })
          }
          </div>
        </div>
		  </div>

      <hr />

      <div className="row">
        <div className="col-lg-3">
          <div className="input-group">
          <div className="input-group-prepend">
              <span className="input-group-text">Stake Amount</span>
            </div>
            <input name="stakeAmount"  type="number" className="form-control" onChange={(event)=>{setStakeAmount(Number(event.target.value))}} value={stakeAmount}/>
          </div>
        </div>
        <div className="col-lg-3">
          <button type="button" className="btn btn-primary m-1" onClick={async ()=>{
            setIsWorking(true);
            await stakeToken(stakeAmount);
            setIsWorking(false);
          }}>Stake</button>
        </div>
      </div>
      <div className="row">
          {
            stakedTokens.map((stakedToken, idx) => {
              return <div key={idx} className='d-flex'>
                <h4>Claimable: {stakedToken.claimable}</h4>
                {!stakedToken.accessible && <Countdown
                  value={stakedToken.cooldown} format="D HH:mm:ss"
                />}
                <button disabled={!stakedToken.accessible} type="button" className="btn btn-danger m-1" onClick={async ()=>{
                  setIsWorking(true);
                  await unstakeToken(stakedToken.stakeData);
                  setIsWorking(false);
                }}>Unstake</button>
                <div className="input-group">
                  <div className="input-group-prepend">
                    <span className="input-group-text">Deposit Amount</span>
                  </div>
                  <input disabled={!stakedToken.accessible} name="depositAmount"  type="number" className="form-control" onChange={(event)=>{setDepositAmount(Number(event.target.value))}} value={depositAmount}/>
                </div>
                <button disabled={!stakedToken.accessible} type="button" className="btn btn-success m-1" onClick={async ()=>{
                  setIsWorking(true);
                  await depositToken(stakedToken.stakeData, depositAmount);
                  setIsWorking(false);
                }}>Deposit</button>
                <button disabled={!stakedToken.accessible} type="button" className="btn btn-warning m-1" onClick={async ()=>{
                  setIsWorking(true);
                  await claimToken(stakedToken.stakeData);
                  setIsWorking(false);
                }}>Claim</button>
              </div>
            })
          }
      </div>
    </div>
    :
    <div className="text-center">Please Connect Wallet</div>
    }
    {(wallet && isWorking) &&
      <div className="loading">
      </div>
    }
	</div>
}