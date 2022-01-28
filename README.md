# Legend and Token Staking on devnet

1. Create token, uncapped supply and decimals 0.

2. Basic UI with token staking portal and Legend Staking portal

3. Token staking 30% rewards (no lock up period required)

4. ‘Legends only’ NFT staking 10 tokens per day emitted per NFT (no lock up period required).

5. NFT staking edited XLEG then XLEG can be staked for a 30% APR reward.

6. Claim reward method is MintTo, not transfer from Pool.

# Current Project Specs

Reward Token Mint:          `XWSNMWWd8yVAyhpP74r1hfzTWtMwSVWmABTazYomuTV`

Reward Token Decimals:      0

Reward Token Metadata:      None (devnet token never has metadata. mainnet-beta token only has metadata - image, name and symbol)

Smart Contract:             `AfmyEmjS81HWfJZu5uHFBQno8PPbYh521dF4HsPv6Dgo`

Pool Id:                    `GQF7dxVQKR8ciHMtS7FBJYAs8Jk3GhUKocFcwfnHRFPK`

Legend Symbol:              `Gorilla`

Legend Reward Amount:       `10`

Legend Reward Time Unit:    `60s`

Token Staking Cooldown:     `300s`

Token Staking APR:          `30%`

Test:                       `npm start` (in `/client/src/`)

To test Legend Staking, you may need to have `Gorilla` NFT at least one.

To test Token Staking, you maybe or not need to have `Token` which's mint id is `XWSNMWWd8yVAyhpP74r1hfzTWtMwSVWmABTazYomuTV` at least 100.

# Smart Contract Build & Deploy

- Build smart contract(Solana Sealevel - program) by Cargo
- Deploy smart contract to Solana chain(BPF - Berkle Packet Filter) by Solana cli

Smart Contract source is placed on `/program`.

## Install dependancies

### Cargo

Cargo is Rust’s build system and package manager. It is same as `NPM` in Node.js project.
In Rust project, you can see `Cargo.toml`. It is same as package.json in Node.js project.

```
$ curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

### Anchor

Anchor is a framework for Solana's Sealevel (opens new window)runtime providing several convenient developer tools.

```
$ npm i -g @project-serum/anchor-cli
```

### Solana

Install in [`here`](https://docs.solana.com/cli/install-solana-cli-tools).

## Build Smart Contract

In program folder, you can run following commands.

```
$ cargo clean
$ cargo build-bpf
```
Then you can see `so` file in `target` sub folder.

## Deploy Smart Contract to devnet

Please check `solana` cli is connected to devnet.
To do this,

```
$ solana config get
```

Check the url is switched `devnet`.

Some SOLs are needed and you'd better `airdrop` some SOLs.

After that run this command.

```
$ solana deploy contract.so
```

After success deployment, you can see the address(pubkey) of contract newly deployed.

Please copy this address for further setting.

Then, please generate IDL json file.

```
$ anchor idl parse -f ./src/lib.rs -o ./target/deploy/contract.json
```

It generates IDL json file int `target` sub folder.
IDL is same as ABI in Ethereum Solidity.(Interface Description Language)

Finally, you successfuly deploy your contract to `devnet`.

You can change network type(Solana cli url) to any one, then deploy smart contract to `main-net`, or `testnet`.

# Prepare environment

Copy the RPC custom node url and paste on `/client/src/pages/stake.tsx: 28n`.
It will determin the chain - mainnet-beta, devnet or testnet.
Current one is my devnet quicknode url.
So it works on devnet.

Copy the contract id and paste on `/client/src/pages/stake.tsx: 29n`.

Copy the token mint key and paste on `/client/src/pages/stake.tsx: 30n`.

# Pool Initialize

Pool should be initialized with token mint author wallet.

It means that only token owner wallet can initialize the Pool.

Because, reward claim is working on `MintTo` method.

So Pool should have mint authority for reward token.

If we initialize the Pool with token owner wallet, mint authority becomes Pool's one.

Current one is blocked for all wallets.

So you need to switch the phantom wallet to token owner wallet and comment `156 ~ 159` lines in `/client/src/pages/stake.tsx`.

Then you can initialize the Pool successfully.

After initialize is finished, it will dump the Pool id on console.

Copy this id and paste on `/client/src/pages/stake.tsx: 41n`.

# Pool Updating

Pool should be updated by initializer wallet.

It can update the constraints of Pool.

They can be `Legend Reward Amount`(per day), `Legend Reward Time Unit`(one day), `Legend NFT symbol`(blockasset), `Cooldown for token stakig`(10 days), `APR`(30%).

All time units are seconds. Be careful when you input the constrains of Pool.


That's it.