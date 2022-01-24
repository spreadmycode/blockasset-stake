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
const { metadata: { Metadata } } = programs;
import axios from "axios";
import moment from 'moment';
import './work.css';
import { IDL } from './idl';

const confirmOption : ConfirmOptions = {
  commitment : 'finalized',
  preflightCommitment : 'finalized',
  skipPreflight : false
}

let conn = new anchor.web3.Connection("https://sparkling-dry-thunder.solana-devnet.quiknode.pro/08975c8cb3c5209785a819fc9a3b2b537d3ba604/");
const programId = new PublicKey('6oT4BVqe6h42o5ZDrBNy4xMqvgMH6GdiSnL1fAPzsJgA');
const rewardMint = new PublicKey('HtJD15RcUEAztidwPqha3t2BDEgLsjZTpzjceGDQYp37');
const idl = IDL as anchor.Idl;

// Constants
const STAKE_LEGEND_DATA_SIZE = 8 + 1 + 32 + 32 + 32 + 8 + 8 + 8;
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export default function Stake() {
	const wallet = useAnchorWallet();
	const notify = useNotify();
  const [pool, setPOOL] = useState<PublicKey>(new PublicKey('AUL42mvLFdZvH5SvtapciCXHJ551yq5RrBUjNumpv6Bp'));
  const [isWorking, setIsWorking] = useState(false);
  const [rewardLegendAmount, setRewardLegendAmount] = useState(10);
  const [periodLegend, setPeirodLegend] = useState(5 * 60);
  const [stakelegendSymbol, setStakeLegendSymbol] = useState("Gorilla");
  const [nfts, setNfts] = useState<Array<any>>([]);
  const [stakedNfts, setStakedNfts] = useState<Array<any>>([]);
  const [poolData, setPoolData] = useState({
    owner: "",
    rand: "",
    rewardMint: "",
    rewardAccount: "",
    rewardTokenAmount: 0,
    rewardLegendAmount: 0,
    periodLegend: 0,
    stakeLegendSymbol: "",
  });

  async function getTokenBalance(tokenAccount : PublicKey) {
    try {
      const amount = (await conn.getTokenAccountBalance(tokenAccount)).value.uiAmount;
      return amount? amount : 0;
    } catch (e) {}
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
      if(signers.length !== 0)
        await transaction.partialSign(...signers);
        // @ts-ignore
      const signedTransaction = await wallet.signTransaction(transaction);
      let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
      await conn.confirmTransaction(hash);
      notify('success', 'Success!');
      return true;
    } catch(err) {
      console.log(err)
      notify('error', 'Failed Instruction!');
      return false;
    }
  }
  
  async function initPool(rewardLegendAmount : number, periodLegend : number, stakeLegendSymbol: string) {
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
        {
          accounts:{
            // @ts-ignore
            owner : wallet.publicKey,
            pool : pool,
            rand : randomPubkey,
            rewardMint : rewardMint,
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

  async function updatePool(rewardLegendAmount : number, periodLegend : number, stakeLegendSymbol: string) {
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

  async function stake(nftMint : PublicKey){
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
  }

  async function unstake(stakeData : PublicKey) {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId, provider);
    let stakedNft = await program.account.stakeData.fetch(stakeData);
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
  }

  async function claim(stakeData : PublicKey){
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
  }
  
  async function getPoolData() {
    let poolData = {
      owner : "Not init",
      rand : "Not init",
      rewardMint : "Not init",
      rewardAccount : "Not init",
      rewardTokenAmount : 0,
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
        rewardAccount : poolFetch.rewardAccount.toBase58(),
        rewardTokenAmount : tokenAmount,
        rewardLegendAmount : poolFetch.rewardLegendAmount.toNumber(),
        periodLegend : poolFetch.periodLegend.toNumber(),
        stakeLegendSymbol : poolFetch.stakeLegendSymbol
      };
    } catch (e) {}
    setPoolData(poolData);
    return poolData;
  }

  async function getNftsForOwner() {
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
          const { data }: any = await axios.get(metadata.data.data.uri)
          if (metadata.data.data.symbol == stakelegendSymbol) {
            const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0]) }
            allTokens.push({address : nftMint, ...entireData })
            console.log(data)
          }
        }
        allTokens.sort(function (a: any, b: any) {
          if (a.name < b.name) { return -1; }
          if (a.name > b.name) { return 1; }
          return 0;
        })
      } catch(err) {
        continue;
      }
    }
    setNfts(allTokens);
    return allTokens;
  }

  async function getStakedNftsForOwner() {
    let provider = new anchor.Provider(conn, wallet as any, confirmOption);
    let program = new anchor.Program(idl,programId, provider);
    const allTokens: any = [];
    let resp = await conn.getProgramAccounts(programId,{
      dataSlice: {length: 0, offset: 0},
      // @ts-ignore
      filters: [{dataSize: STAKE_LEGEND_DATA_SIZE},{memcmp:{offset:9, bytes:wallet?.publicKey.toBase58()}},{memcmp:{offset:41, bytes:pool.toBase58()}}]
    })
    for(let nftAccount of resp){
      let stakedNft = await program.account.stakeData.fetch(nftAccount.pubkey)
      if(stakedNft.unstaked) continue;
      let number = Math.floor(((moment().unix() - stakedNft.stakeTime) / poolData.periodLegend));
      let claimable = poolData.rewardLegendAmount * (number - stakedNft.withdrawnNumber);
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

  async function refresh() {
    await getPoolData();
    await getNftsForOwner();
    await getStakedNftsForOwner();
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
    {wallet ?
    <div className="container-fluid mt-4">
      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="input-group">
            <div className="input-group-prepend">
              <span className="input-group-text">Reward amount</span>
            </div>
            <input name="rewardLegendAmount"  type="number" className="form-control" onChange={(event)=>{setRewardLegendAmount(Number(event.target.value))}} value={rewardLegendAmount}/>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="input-group">
            <div className="input-group-prepend">
              <span className="input-group-text">Reward Period</span>
            </div>
            <input name="periodLegend"  type="number" className="form-control" onChange={(event)=>{setPeirodLegend(Number(event.target.value))}} value={periodLegend}/>
          </div>
        </div>
        <div className="col-lg-1">
          <div className="input-group">
          <div className="input-group-prepend">
              <span className="input-group-text">Legend Symbol</span>
            </div>
            <input name="stakeLegendSymbol"  type="text" className="form-control" onChange={(event)=>{setStakeLegendSymbol(event.target.value)}} value={stakelegendSymbol}/>
          </div>
        </div>
        <div className="col-lg-5">
          <button type="button" className="btn btn-warning m-1" onClick={async () => {
            setIsWorking(true);
            await initPool(rewardLegendAmount, periodLegend, stakelegendSymbol);
            setIsWorking(false);
          }}>Create Staking Pool</button>
          <button type="button" className="btn btn-warning m-1" onClick={async () => {
            setIsWorking(true);
            await updatePool(rewardLegendAmount, periodLegend, stakelegendSymbol);
            setIsWorking(false);
          }}>Update Staking Pool</button>
        </div>
      </div>

      <hr />

      <div className="row mb-3">
        <h4>Pool Info</h4>
        <h5>{"Owner: " + poolData.owner}</h5>
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
									await stake(nft.address)
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
                <button type="button" className="btn btn-success" onClick={async ()=>{
                  await unstake(nft.stakeData)
                }}>Unstake</button>
                {
                  (nft.claimable > 0) && 
                  <button type="button" className="btn btn-success" onClick={async ()=>{
                    await claim(nft.stakeData)
                  }}>Claim</button>
                }
              </div>
            </div>
          })
        }
        </div>
      </div>
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