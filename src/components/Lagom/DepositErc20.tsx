import React, { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { makeStyles } from "@mui/styles";
import {
  IHybridPaymaster,
  PaymasterMode,
  SponsorUserOperationDto,
} from "@biconomy/paymaster";

import Button from "../Button";
import { useWeb3AuthContext } from "../../contexts/SocialLoginContext";
import { useSmartAccountContext } from "../../contexts/SmartAccountContext";
import {
  configInfo as config,
  showErrorMessage,
  showSuccessMessage,
} from "../../utils";

const DepositErc20: React.FC = () => {
  const classes = useStyles();
  const { web3Provider } = useWeb3AuthContext();
  const { smartAccount, scwAddress } = useSmartAccountContext();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [amtToDeposit, setAmtToDeposit] = useState(0);
  const [dec, setDec] = useState(0); // decimals of erc20

  const getBalance = useCallback(async () => {
    if (!scwAddress || !web3Provider) return;
    const usdtContract = new ethers.Contract(
      config.usdt.address,
      config.usdt.abi,
      web3Provider
    );
    setDec(await usdtContract.decimals());
    const count = await usdtContract.balanceOf(scwAddress);
    console.log("count", Number(count));
    setBalance(Number(count));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getBalance();
  }, [getBalance, web3Provider]);

  const makeTx = async () => {
    if (!scwAddress || !web3Provider || !smartAccount) return;
    try {
      setLoading(true);
      const iFace = new ethers.utils.Interface(config.usdt.abi);
      const txs = [];

      const approveCallData = iFace.encodeFunctionData("approve", [
        config.lagomContract.address,
        ethers.utils.parseUnits(amtToDeposit.toString(), dec),
      ]);
      const tx1 = {
        to: config.usdt.address,
        data: approveCallData,
      };
      txs.push(tx1);

      const LagomContract = new ethers.Contract(
        config.lagomContract.address,
        config.lagomContract.abi,
        web3Provider
      );

      const depositErc20 = await LagomContract.populateTransaction.deposit(
        config.usdt.address,
        ethers.utils.parseUnits(amtToDeposit.toString(), dec),
        {
          from: scwAddress,
        }
      );

      const tx2 = {
        to: config.lagomContract.address,
        data: depositErc20.data,
      };
      txs.push(tx2);

      let userOp = await smartAccount.buildUserOp(txs);
      const biconomyPaymaster =
        smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
      let paymasterServiceData: SponsorUserOperationDto = {
        mode: PaymasterMode.SPONSORED,
      };
      const paymasterAndDataResponse =
        await biconomyPaymaster.getPaymasterAndData(
          userOp,
          paymasterServiceData
        );
      userOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;
      const userOpResponse = await smartAccount.sendUserOp(userOp);
      console.log("userOpHash", userOpResponse);
      const { receipt } = await userOpResponse.wait(1);
      console.log("txHash", receipt.transactionHash);
      showSuccessMessage(
        `Deposited ERC20 ${receipt.transactionHash}`,
        receipt.transactionHash
      );
      setLoading(false);
      setAmtToDeposit(0);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      getBalance();
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      setAmtToDeposit(0);
      showErrorMessage(err.message || "Error in sending the transaction");
    }
  };

  return (
    <main className={classes.main}>
      <p style={{ color: "#7E7E7E" }}>
        Use Cases {"->"} Gasless {"->"} Deposit ERC-20
      </p>

      <h3 className={classes.subTitle}>Deposit ERC20 Gasless Flow</h3>

      <p>This is single transaction to deposit an ERC-20 token into Lagom.</p>

      <p>
        ERC20 Token: {config.usdt.address}{" "}
        <span style={{ fontSize: 13, color: "#FFB4B4" }}>(mumbai)</span>
      </p>
      <p style={{ marginBottom: 30, marginTop: 30, fontSize: 24 }}>
        ERC20 Balance in SCW:{" "}
        {balance === null ? (
          <p style={{ color: "#7E7E7E", display: "contents" }}>fetching...</p>
        ) : (
          ethers.utils.formatUnits(balance.toString(), 6)
        )}
      </p>

      <h3 className={classes.h3Title}>Enter the amount to deposit</h3>

      <input
        type="number"
        placeholder="0"
        value={amtToDeposit}
        onChange={(e) => setAmtToDeposit(+e.target.value)}
        className={classes.input}
      />

      <Button title="Deposit ERC-20" isLoading={loading} onClickFunc={makeTx} />
    </main>
  );
};

const useStyles = makeStyles(() => ({
  main: {
    padding: "10px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "start",
    justifyContent: "center",
  },
  subTitle: {
    color: "#FFB999",
    fontSize: 36,
    margin: 0,
  },
  h3Title: {
    color: "#e6e6e6",
  },
  input: {
    maxWidth: 350,
    width: "100%",
    padding: "12px 10px",
    margin: "8px 0",
    color: "#e6e6e6",
    boxSizing: "border-box",
    outlineColor: "#181818",
    backgroundColor: "#282A3A",
    border: "none",
    marginBottom: 20,
  },
}));

export default DepositErc20;
