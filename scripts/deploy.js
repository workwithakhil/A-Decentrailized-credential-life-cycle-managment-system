const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network :", network.name);
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance :",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "\n"
  );

  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  console.log("DIDRegistry         ", await didRegistry.getAddress());

  const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistry.deploy();
  await issuerRegistry.waitForDeployment();
  console.log("IssuerRegistry      ", await issuerRegistry.getAddress());

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(
    await issuerRegistry.getAddress()
  );
  await credentialRegistry.waitForDeployment();
  console.log("CredentialRegistry  ", await credentialRegistry.getAddress());

  const VerificationRegistry = await ethers.getContractFactory(
    "VerificationRegistry"
  );
  const verificationRegistry = await VerificationRegistry.deploy(
    await credentialRegistry.getAddress(),
    await issuerRegistry.getAddress()
  );
  await verificationRegistry.waitForDeployment();
  console.log("VerificationRegistry", await verificationRegistry.getAddress());

  // Register the deployer as the first issuer so you can demo immediately.
  const tx = await issuerRegistry.registerIssuer(
    deployer.address,
    "State University"
  );
  await tx.wait();
  console.log("\nRegistered issuer   ", deployer.address, "(State University)");

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      DIDRegistry: await didRegistry.getAddress(),
      IssuerRegistry: await issuerRegistry.getAddress(),
      CredentialRegistry: await credentialRegistry.getAddress(),
      VerificationRegistry: await verificationRegistry.getAddress(),
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log("\nSaved addresses to  ", outFile);

  // Also drop them where the frontend can read them.
  //
  // The frontend is a PUBLIC bundle, so only key-free values go there:
  // contract addresses, the chain ID and a public RPC URL. Never copy
  // AMOY_RPC_URL from .env — it may contain a provider API key.
  const PUBLIC_RPC = {
    31337: "http://127.0.0.1:8545",
    80002: "https://polygon-amoy.gateway.tenderly.co",
  };
  const frontendRpc =
    process.env.FRONTEND_RPC_URL || PUBLIC_RPC[deployment.chainId];
  if (!frontendRpc) {
    throw new Error(
      `No public RPC known for chain ${deployment.chainId}. ` +
        "Set FRONTEND_RPC_URL to a public endpoint (no API key)."
    );
  }
  const feDir = path.join(__dirname, "..", "frontend", "src", "abis");
  if (fs.existsSync(feDir)) {
    fs.writeFileSync(
      path.join(feDir, "addresses.json"),
      JSON.stringify(deployment.contracts, null, 2)
    );
    // Tell the frontend which chain to read from when no wallet is connected.
    fs.writeFileSync(
      path.join(feDir, "network.json"),
      JSON.stringify(
        {
          chainId: deployment.chainId,
          name: network.name,
          rpcUrl: frontendRpc,
        },
        null,
        2
      )
    );
    console.log("Copied to frontend  ", path.join(feDir, "addresses.json"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
