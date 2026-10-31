"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner, Contract, ethers } from "ethers"
import { SEPOLIA_CHAIN_ID } from "./contracts"

type Web3ContextType = {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  account: string | null
  chainId: number | null
  isConnected: boolean
  isSepolia: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)

  const isConnected = !!account
  const isSepolia = chainId === SEPOLIA_CHAIN_ID

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const ethProvider = new BrowserProvider(window.ethereum)
      setProvider(ethProvider)

      ethProvider.getSigner().then((s) => setSigner(s)).catch(() => {})
      ethProvider.getNetwork().then((n) => setChainId(Number(n.chainId))).catch(() => {})

      const handleAccounts = (accounts: string[]) => {
        setAccount(accounts[0] ?? null)
        if (accounts[0]) ethProvider.getSigner().then(setSigner)
        else setSigner(null)
      }
      const handleChain = (chain: string) => setChainId(Number(chain))

      window.ethereum.on("accountsChanged", handleAccounts)
      window.ethereum.on("chainChanged", handleChain)

      window.ethereum.request({ method: "eth_accounts" }).then((accs: string[]) => {
        if ((accs as string[]).length > 0) setAccount((accs as string[])[0])
      })

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccounts)
        window.ethereum.removeListener("chainChanged", handleChain)
      }
    }
  }, [])

  const connect = async () => {
    if (!provider) throw new Error("No provider")
    await provider.send("eth_requestAccounts", [])
    const accounts = await provider.listAccounts()
    if (accounts.length > 0) {
      setAccount(accounts[0])
      setSigner(provider.getSigner())
    }
    const network = await provider.getNetwork()
    setChainId(Number(network.chainId))
  }

  const disconnect = () => {
    setAccount(null)
    setSigner(null)
  }

  return (
    <Web3Context.Provider value={{ provider, signer, account, chainId, isConnected, isSepolia, connect, disconnect }}>
      {children}
    </Web3Context.Provider>
  )
}

export function useWeb3() {
  const ctx = useContext(Web3Context)
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider")
  return ctx
}

export function getContract(address: string, abi: any[], signerOrProvider: any) {
  return new Contract(address, abi, signerOrProvider)
}
