import { RawAbiDefinition, parse, Contract, AbiParameter } from "./abiParser";
import { getVersion } from "./utils";
import { EvmType } from "./typeParser";

export function generateSource(abi: Array<RawAbiDefinition>, contractName: string): string {
  const parsedContractAbi = parse(abi);

  return codeGenForContract(abi, parsedContractAbi, contractName);
}

// @todo fix formatting of generate code
// @todo better typings for web3
function codeGenForContract(abi: Array<RawAbiDefinition>, input: Contract, contractName: string) {
  const typeName = `${contractName}`;
  return `/* GENERATED BY TYPECHAIN VER. ${getVersion()} */
  
import { BigNumber } from "bignumber.js";
import { TypechainContract, promisify, ITxParams, IPayableTxParams } from '../../../runtime/typechain-runtime'

export class ${typeName} extends TypechainContract {
    public readonly rawWeb3Contract: any;
  
    public constructor(web3: any, address: string) {
      const abi = ${JSON.stringify(abi)};
      super(web3, address, abi);
    }

    static async createAndValidate(web3: any, address: string): Promise<${typeName}> {
      const contract = new ${typeName}(web3, address);
      const code = await promisify(web3.eth.getCode, [address]);
      if (code === "0x0") {
        throw new Error(\`Contract at \${address} doesn't exist!\`);
      }
      return contract; 
    }
    
    ${input.constants
      .map(
        constant =>
          `public get ${
            constant.name
          }(): Promise<${constant.output.generateCodeForOutput()}> { return promisify(this.rawWeb3Contract.${
            constant.name
          }, []); }`
      )
      .join("\n")} 
      ${input.constantFunctions
        .map(
          constantFunction =>
            `public ${constantFunction.name}(${constantFunction.inputs
              .map(codeGenForParams)
              .join(", ")}): Promise<${codeGenForOutputTypelist(
              constantFunction.outputs
            )}> { return promisify(this.rawWeb3Contract.${
              constantFunction.name
            }, [${constantFunction.inputs.map(codeGenForArgs).join(", ")}]); }`
        )
        .join(";\n")} 

        ${input.functions
          .map(
            func =>
              `public ${func.name}Tx(${func.inputs.map(codeGenForParams).join(", ") +
                (func.inputs.length === 0 ? "" : ", ")}params?: ${
                func.payable ? "IPayableTxParams" : "ITxParams"
              }): Promise<${codeGenForOutputTypelist(
                func.outputs
              )}> { return promisify(this.rawWeb3Contract.${func.name}, [${func.inputs
                .map(codeGenForArgs)
                .join(", ") + (func.inputs.length === 0 ? "" : ", ")}params ]); }`
          )
          .join(";\n")} 
}`;
}

function codeGenForParams(param: AbiParameter): string {
  return `${param.name || "index"}: ${param.type.generateCodeForInput()}`;
}

function codeGenForArgs(param: AbiParameter): string {
  return `${param.name || "index"}`;
}

function codeGenForOutputTypelist(output: Array<EvmType>): string {
  if (output.length === 1) {
    return output[0].generateCodeForOutput();
  } else {
    return `[${output.map(x => x.generateCodeForOutput()).join(", ")}]`;
  }
}
