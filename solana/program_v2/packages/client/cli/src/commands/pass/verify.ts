// import { GatekeeperService } from '@identity.com/gateway-solana-client';
import {
  GatekeeperService,
  ExtendedCluster,
} from '@identity.com/gateway-solana-client';
import { Command, Flags } from '@oclif/core';
import { Keypair, PublicKey } from '@solana/web3.js';
import fsPromises from 'node:fs/promises';

export default class Verify extends Command {
  static description = 'Verifies a gateway pass';

  static examples = [
    `$ gateway pass verify --pass [address] --network [address] --keypair [path to keypair] --cluster [cluster type]
`,
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    pass: Flags.string({
      char: 's',
      description: 'The address of the issued pass',
      required: true,
    }),
    network: Flags.string({
      char: 'n',
      description: "String representing the network's address",
      required: true,
    }),
    keypair: Flags.string({
      char: 'k',
      description: 'Path to a solana keypair',
      required: true,
    }),
    cluster: Flags.string({
      char: 'c',
      description: 'The cluster you wish to use',
      required: true,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Verify);

    const pass = new PublicKey(flags.pass);
    const network = new PublicKey(flags.network);
    const gatekeeper = Keypair.generate().publicKey;
    const cluster =
      flags.cluster === 'localnet' ||
      flags.cluster === 'devnet' ||
      flags.cluster === 'mainnet' ||
      flags.cluster === 'civicnet' ||
      flags.cluster === 'testnet'
        ? flags.cluster
        : 'localnet';

    const localSecretKey = await fsPromises.readFile(`${flags.keypair}`);
    const privateKey = Uint8Array.from(JSON.parse(localSecretKey.toString()));
    const authorityKeypair = Keypair.fromSecretKey(privateKey);

    const gatekeeperService = await GatekeeperService.build(
      network,
      gatekeeper,
      { clusterType: cluster as ExtendedCluster }
    );

    const verifiedPassSignature = await gatekeeperService
      .verifyPass(pass, authorityKeypair.publicKey)
      .rpc();
    this.log(
      `Pass Verified — Verification TX Signature: ${verifiedPassSignature}`
    );
  }
}
