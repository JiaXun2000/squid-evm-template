import { ethers } from "ethers";
import { abi, events } from "./abi/erc20";
import * as pancakePair from "./abi/PancakePair";
import { TVLChart, Transfer, ContractLP } from "./model";
import { EvmLogHandlerContext } from "@subsquid/substrate-evm-processor"; 

//import * as pair from "./abi/uniswap-pair"

export const CHAIN_NODE = "wss://astar.api.onfinality.io/public-ws";

//export const ORU_USDC_PAIR = "0x43783EcE7b46BB026D4CeBfd3e29f539Ff1914fB".toLowerCase();
//export const OUSD_USDC_PAIR = "0xCf83a3d83c1265780d9374e8a7c838fE22BD3DC6".toLowerCase();
//export const OUSD_ORU_PAIR = "0xE5A11AfBed6a0fC59e69493F7142ef7e454e809f".toLowerCase();

export const  SDN_USDC = "0xdB9a42E1165bA2fc479e1f2C1ce939807dbe6020".toLowerCase();
export const  aKSU_Pool = "0xc5b8D0eC15984653A7554878eE9b4212EA059Fd2".toLowerCase();
 

export const SDN_USDC_Contract = new ethers.Contract(
  "0xdB9a42E1165bA2fc479e1f2C1ce939807dbe6020".toLowerCase(),
  abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);
export const SDN_Contract = new ethers.Contract(
  "0x75364D4F779d0Bd0facD9a218c67f87dD9Aff3b4".toLowerCase(),
  abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);
export const USDC_Contract = new ethers.Contract(
  "0x6a2d262D56735DbA19Dd70682B39F6bE9a931D98".toLowerCase(),
  abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);

export function createContractEntityLP(): ContractLP {
  return new ContractLP({
    id: SDN_USDC_Contract.address,
    name: "SDN_USDC_LP_TOKEN",
  });
}

export async function contractLogsIncHandler(
  ctx: EvmLogHandlerContext
): Promise<void> {

  const transfer = pancakePair.events["Transfer(address,address,uint256)"].decode(ctx);

  let fromNew = transfer.from;
  let toNew = transfer.to
  let amountNew = transfer.value
  
  console.log("We are here!")
  console.log(transfer);

  //let from = await ctx.store.get(Transfer, transfer.from);
  //let to = await ctx.store.get(Transfer, transfer.to);
  let transferOld = await ctx.store.get(Transfer);

  //The "amount" here is the sum of the "amounts" of all the previous Transfer Events in the database
  if(transferOld == null){
    transferOld = new Transfer({
      id: ctx.txHash,
      from: transfer.from,
      to: transfer.to,
      amount: BigInt(amountNew.toString()),
      timestamp: BigInt(ctx.substrate.block.timestamp)
    });
    await ctx.store.save(transferOld);
  }else{
    let amount = Number(transferOld.amount);
    if(toNew == aKSU_Pool){
      amount = amount + Number(amountNew);
  
    await ctx.store.save(
      new Transfer({
        id: ctx.txHash,
        from: fromNew,
        to: toNew,
        amount: BigInt(amountNew.toString()),
        timestamp: BigInt(ctx.substrate.block.timestamp)
      })
    );
    }
  
    
  //"percentOfLP" means the number of LP Tokens in the pool as a percentage of the LP Token Contract
  let percentOfLP = Number(amountNew) / Number(SDN_USDC_Contract.totalSupply());

  //if we got these two values, we can caculate the value of this LP Token
  // let token0 = SDN_Contract.balanceOf(SDN_USDC_Contract.address);
  // let token1 = USDC_Contract.balanceOf(SDN_USDC_Contract.address);
  
  let amount0 = Number(SDN_Contract.balanceOf(SDN_USDC_Contract.address));
  let amount1 = Number(USDC_Contract.balanceOf(SDN_USDC_Contract.address));

  //let amount0out = SDN_USDC_Contract.balanceOf(token0);
  //let amount1out = SDN_USDC_Contract.balanceOf(token1);

  let price0 = 1;
  let price1 = 1;

  price0 = amount1 / amount0;

  let valueNew = ((amount0 * price0) + (amount1 * price1)) * percentOfLP;

  let charts = await ctx.store.getRepository(TVLChart);
  const chartsLength =  await charts.count();
  if (chartsLength !== 0) {
    const lastChart = await charts.find({id: (chartsLength - 1).toString()});
    const newTvlValue = (valueNew) + (+(lastChart[0].value))
    
    await ctx.store.save(
      new TVLChart({
          id: (chartsLength).toString(),
          from: fromNew,
          to: toNew,
          currentTimestamp: BigInt(ctx.substrate.block.timestamp),
          value: newTvlValue
      })
  )
  }
  }
}

export async function contractLogsDecHandler(
  ctx: EvmLogHandlerContext
): Promise<void> {
  const transfer = events["Transfer(address,address,uint256)"].decode(ctx);

  let fromNew = transfer.from;
  let toNew = transfer.to
  let amountNew = transfer.value

  console.log(transfer);
  
  let transferOld = await ctx.store.get(Transfer);
  if(transferOld == null){
    transferOld = new Transfer({
      id: ctx.txHash,
      from: transfer.from,
      to: transfer.to,
      amount: BigInt(amountNew.toString()),
      timestamp: BigInt(ctx.substrate.block.timestamp)
    });
    await ctx.store.save(transferOld);
  }else{
    //This sentence means to determine whether the toAddress is a specific address, such as 0x, so that the tvl of the "pool" will change according to a specific pattern
    if(transferOld.to == "0x0000000000000000000000000000000000000000"){
      await ctx.store.save(transferOld);

    }
    else{
      let amount = Number(transferOld.amount);
      if(toNew == aKSU_Pool){
        amount = amount + Number(amountNew);
  
        await ctx.store.save(
          new Transfer({
            id: ctx.txHash,
            from: fromNew,
            to: toNew,
            amount: BigInt(amountNew.toString()),
            timestamp: BigInt(ctx.substrate.block.timestamp)
          })
        );
      }
    //percentOfLP is the value of this Transfer Event
    let percentOfLP = Number(amountNew) / Number(SDN_USDC_Contract.totalSupply());

    //if we got these two values, we can caculate the value of this LP Token
    // let token0 = SDN_Contract.balanceOf(SDN_USDC_Contract.address);
    // let token1 = USDC_Contract.balanceOf(SDN_USDC_Contract.address);
  
    let amount0 = Number(SDN_Contract.balanceOf(SDN_USDC_Contract.address));
    let amount1 = Number(USDC_Contract.balanceOf(SDN_USDC_Contract.address));

    //let amount0out = SDN_USDC_Contract.balanceOf(token0);
    //let amount1out = SDN_USDC_Contract.balanceOf(token1);

    let price0 = 1;
    let price1 = 1;

    price0 = amount1 / amount0;

    //
    let valueNew = ((amount0 * price0) + (amount1 * price1)) * percentOfLP;

    let charts = await ctx.store.getRepository(TVLChart);
    const chartsLength =  await charts.count();

    const lastChart = await charts.find({id: (chartsLength - 1).toString()});
    const newTvlValue = (+(lastChart[0].value)) - (valueNew);
    
    await ctx.store.save(
      new TVLChart({
          id: (chartsLength).toString(),
          from: fromNew,
          to: toNew,
          currentTimestamp: BigInt(ctx.substrate.block.timestamp),
          value: newTvlValue
      })
    )
    }
  }
}

























// export const ORU_USDC_PAIRContract = new ethers.Contract(
//   "0x43783EcE7b46BB026D4CeBfd3e29f539Ff1914fB".toLowerCase(),
//   abi,
//   new ethers.providers.WebSocketProvider(CHAIN_NODE)
// );

// export async function tvlChartIncLogsHandlerNew(ctx: EvmLogHandlerContext): Promise<void> {
//   console.log("Triggered ArthswapLPs-Inc");
//   return tvlChartIncLogsHandler(ctx, KAC_SDN_Contract);
// }
// export async function tvlChartIncLogsHandler(ctx: EvmLogHandlerContext, ethersContract: ethers.Contract): Promise<void> {
  
//   let amt0 = 1;
//   let amt1 = 1;

//   let price0 = 1;
//   let price1 = 1;

//     //if (pairAddress === ORU_USDC_PAIR) 
  
//   amount / KAC_SDN_Contract.totalSupply();



//   amt0 = Number(mintEvent.amount0) / 1e6;  //USDC
//   amt1 = Number(mintEvent.amount1) / 1e18; //ORU
    
//   price0 = 1;
//   price1 = amt0 / amt1;

//   //tvl: amt0 * price0 + amt1 * price1  
//   let tvlValue = (amt0 * price0) + (amt1 * price1);

// }


// await ctx.store.save(
//   new TVLChart({
//     id: ctx.txHash,
//     from: fromNew,
//     currentTimestamp: BigInt(ctx.substrate.block.timestamp),
//     amount: amountNew
//     value: 
//   })
// );


// export async function tvlChartIncLogsHandlerNew(ctx: EvmLogHandlerContext): Promise<void> {
// console.log("Triggered ArthswapLPs-Inc");
// return tvlChartIncLogsHandler(ctx, ORU_USDC_PAIRContract);
// }
// export async function tvlChartDecLogsHandlerNew(ctx: EvmLogHandlerContext): Promise<void> {
//   console.log("Triggered ArthswapLPs-Dec");
//   return tvlChartDecLogsHandler(ctx, ORU_USDC_PAIRContract);
//   }

// export async function tvlChartIncLogsHandler(ctx: EvmLogHandlerContext, ethersContract: ethers.Contract): Promise<void> {

//   //caculate tvl and value of the contract
//   //const swapEvent = pancakePair.events["Swap(address,uint256,uint256,uint256,uint256,address)"].decode(ctx);
//   //const transfer = erc20.events["Transfer(address,address,uint256)"].decode(ctx); this is a invalid step when you want to get the tvl of LP Token
//   let provider = new ethers.providers.WebSocketProvider(CHAIN_NODE);
//   const pairAddress = ethersContract.address;
//   const contractEntity = new ethers.Contract(pairAddress, abi, provider)
//   //LP Token address
//   //const pairAddress = ctx.contractAddress;
  

//   //mintEvent used to caculate totalSupply of the LP Token
//   const mintEvent = pair.events["Mint(address,uint256,uint256)"].decode(ctx);

//   let amt0 = 1;
//   let amt1 = 1;

//   let price0 = 1;
//   let price1 = 1;

//   //if (pairAddress === ORU_USDC_PAIR) 
  
//   amt0 = Number(mintEvent.amount0) / 1e6;  //USDC
//   amt1 = Number(mintEvent.amount1) / 1e18; //ORU
    
//   price0 = 1;
//   price1 = amt0 / amt1;

//   //tvl: amt0 * price0 + amt1 * price1  
//   let tvlValue = (amt0 * price0) + (amt1 * price1);

//     await ctx.store.save(
//       new TVLChart({
//           id: ctx.txHash.toString(),
//           currentTimestamp: BigInt(ctx.substrate.block.timestamp),
//           value: tvlValue
//       })
//     )

//   //const charts = await ctx.store.getRepository(TVLChart);
  
//   //let balance = await ctx.store.get(TVLChart, transfer.value.toString());

  

//   //let balanceOf = ctx.store.get(Owner, transfer.from);
  

// }

// export async function tvlChartDecLogsHandler(ctx: EvmLogHandlerContext, ethersContract: ethers.Contract): Promise<void> {
//   //const swapEvent = pancakePair.events["Swap(address,uint256,uint256,uint256,uint256,address)"].decode(ctx);

//   //const pairAddress = ethersContract.address;

//   const burnEvent = pair.events["Burn(address,uint256,uint256,address)"].decode(ctx);

//   let amt0 = 1;
//   let amt1 = 1;

//   let price0 = 1;
//   let price1 = 1;

//   //if(pairAddress === ORU_USDC_PAIR)

//   amt0 = Number(burnEvent.amount0) / 1e6;
//   amt1 = Number(burnEvent.amount1) / 1e18;

//   price0 = 1;
//   price1 = amt0 / amt1;
  
  

//   let tvlValue = (amt0 * price0) + (amt1 * price1);

//   await ctx.store.save(
//     new TVLChart({
//         id: ctx.txHash,
//         currentTimestamp: BigInt(ctx.substrate.block.timestamp),
//         value: tvlValue
//     })
//   )
// }
