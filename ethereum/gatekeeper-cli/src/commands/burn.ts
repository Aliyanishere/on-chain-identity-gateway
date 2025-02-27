import {
  confirmationsFlag,
  feesFlag, gatekeeperNetworkFlag,
  gatewayTokenAddressFlag,
  chainFlag, parseFlagsWithPrivateKey,
  privateKeyFlag, gasLimitFlag,
} from '../utils/oclif/flags'
import {Command, Flags} from '@oclif/core'
import {makeGatewayTs} from '../utils/oclif/utils'
import {addressArg} from '../utils/oclif/args'

export default class BurnToken extends Command {
  static description = 'Burn existing gateway token';

  static examples = [
    `$ gateway-eth burn 0x893F4Be53274353CD3379C87C8fd1cb4f8458F94 -n 123
		`,
  ];

  static flags = {
    help: Flags.help({char: 'h'}),
    privateKey: privateKeyFlag(),
    gatewayTokenAddress: gatewayTokenAddressFlag(),
    gatekeeperNetwork: gatekeeperNetworkFlag(),
    chain: chainFlag(),
    fees: feesFlag(),
    gasLimit: gasLimitFlag(),
    confirmations: confirmationsFlag(),
  };

  static args = [addressArg({description: 'Token owner address'})];

  async run(): Promise<void> {
    const {args, flags} = await this.parse(BurnToken)

    const ownerAddress = args.address as string
    const parsedFlags = parseFlagsWithPrivateKey(flags)

    this.log(`Burning token for ${ownerAddress}`)

    const gateway = await makeGatewayTs(parsedFlags)

    const sendableTransaction = await gateway.burn(
      ownerAddress, parsedFlags.gatekeeperNetwork,
    )

    this.log(`Transaction hash: ${sendableTransaction.hash}`)

    const receipt = await sendableTransaction.wait(flags.confirmations)

    this.log(`Token burned. TxHash: ${receipt.transactionHash}`)
  }
}
