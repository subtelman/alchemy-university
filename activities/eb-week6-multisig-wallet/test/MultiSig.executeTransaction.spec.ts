import type { JsonRpcSigner } from "@ethersproject/providers";
import type { Contract } from "ethers";
import { ethers } from "hardhat";
import { assert } from "chai";

async function expectThrow(promise: Promise<any>) {
  try {
    await promise;
  } catch (err) {
    return;
  }
  assert(false, "Expected the transaction to revert!");
}

describe("MultiSig: executeTransaction()", function () {
  let contract: Contract;
  let accounts: string[];
  let signer1: JsonRpcSigner;
  let _required = 2;

  beforeEach(async () => {
    accounts = await ethers.provider.listAccounts();
    const MultiSig = await ethers.getContractFactory("MultiSig");
    contract = await MultiSig.deploy(accounts.slice(0, 3), _required);
    await contract.deployed();
    signer1 = ethers.provider.getSigner(accounts[1]);
  });

  it("should execute a transaction if confirmation threshold is met", async function () {
    const value = ethers.utils.parseEther("1");
    await signer1.sendTransaction({ to: contract.address, value });
    await contract.submitTransaction(
      accounts[1],
      ethers.utils.parseEther(".5"),
      "0x"
    );
    await contract.connect(signer1).confirmTransaction(0);
    let txn = await contract.callStatic.transactions(0);
    assert.equal(txn[2], true, "Expected `executed` bool to be true!");
  });

  it("should not execute a transaction if confirmation threshold is not met", async function () {
    const value = ethers.utils.parseEther("1");
    await signer1.sendTransaction({ to: contract.address, value });
    await contract.submitTransaction(
      accounts[1],
      ethers.utils.parseEther(".5"),
      "0x"
    );
    await expectThrow(contract.executeTransaction(0));
  });

  it("should transfer funds to the beneficiary", async function () {
    const value = ethers.utils.parseEther("1");
    const transferValue = ethers.utils.parseEther(".5");
    const recipient = accounts[2];

    const balanceBefore = await ethers.provider.getBalance(recipient);
    const contractBalanceBefore = await ethers.provider.getBalance(
      contract.address
    );

    await signer1.sendTransaction({ to: contract.address, value });
    await contract.submitTransaction(recipient, transferValue, "0x");
    await contract.connect(signer1).confirmTransaction(0);

    const balanceAfter = await ethers.provider.getBalance(recipient);
    const contractBalanceAfter = await ethers.provider.getBalance(
      contract.address
    );

    assert.equal(
      balanceAfter.sub(balanceBefore).toString(),
      transferValue.toString()
    );
    assert.equal(
      contractBalanceAfter.sub(contractBalanceBefore).toString(),
      transferValue.toString()
    );
  });

  it("should only allow valid owners to execute", async function () {
    const value = ethers.utils.parseEther("1");
    const transferValue = ethers.utils.parseEther(".5");
    await signer1.sendTransaction({ to: contract.address, value });
    await contract.submitTransaction(accounts[1], transferValue, "0x");
    await expectThrow(
      contract.connect(ethers.provider.getSigner(6)).executeTransaction(0)
    );
  });
});
