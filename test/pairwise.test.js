const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gap closure — pairwise identifiers (Liu et al. link analysis)", function () {
  let didRegistry, pairwise;
  let holder, verifierA, verifierB, attacker, pwA, pwB;

  beforeEach(async function () {
    [holder, verifierA, verifierB, attacker, pwA, pwB] = await ethers.getSigners();
    didRegistry = await (await ethers.getContractFactory("DIDRegistry")).deploy();
    pairwise = await (
      await ethers.getContractFactory("PairwiseDIDRegistry")
    ).deploy(await didRegistry.getAddress());
  });

  it("a holder presents a different address to each verifier", async function () {
    await pairwise.connect(holder).bindPairwise(holder.address, verifierA.address, pwA.address);
    await pairwise.connect(holder).bindPairwise(holder.address, verifierB.address, pwB.address);

    const seenByA = await pairwise.pairwiseFor(holder.address, verifierA.address);
    const seenByB = await pairwise.pairwiseFor(holder.address, verifierB.address);

    expect(seenByA).to.not.equal(seenByB);          // no correlation by address
    expect(seenByA).to.not.equal(holder.address);   // root never exposed to verifier
    expect(await pairwise.pairwiseCount(holder.address)).to.equal(2n);
  });

  it("only the root controller can bind a pairwise identity", async function () {
    await expect(
      pairwise.connect(attacker).bindPairwise(holder.address, verifierA.address, pwA.address)
    ).to.be.revertedWithCustomError(pairwise, "NotRootController");
  });

  it("a pairwise address cannot be reused by another root", async function () {
    await pairwise.connect(holder).bindPairwise(holder.address, verifierA.address, pwA.address);
    await expect(
      pairwise.connect(attacker).bindPairwise(attacker.address, verifierA.address, pwA.address)
    ).to.be.revertedWithCustomError(pairwise, "PairwiseInUse");
  });

  it("resolves a pairwise identity back to its root", async function () {
    await pairwise.connect(holder).bindPairwise(holder.address, verifierA.address, pwA.address);
    expect(await pairwise.resolveRoot(pwA.address)).to.equal(holder.address);
    expect(await pairwise.resolveRoot(holder.address)).to.equal(holder.address);
  });

  it("HONEST LIMIT: the root-to-pairwise link is publicly readable on-chain", async function () {
    // This test documents the limitation rather than a feature. A chain analyst
    // CAN follow the mapping. Only address-level correlation by the verifier is
    // defeated. Full unlinkability requires Liu et al.'s DAC construction.
    await pairwise.connect(holder).bindPairwise(holder.address, verifierA.address, pwA.address);
    const publiclyVisibleRoot = await pairwise.rootOf(pwA.address);
    expect(publiclyVisibleRoot).to.equal(holder.address);
  });
});
