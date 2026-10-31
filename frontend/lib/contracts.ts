export const CONTRACT_ADDRESSES: Record<string, string> = {
  DependencyGraph: "",
  Jury: "",
  WeightingEngine: "",
  DistributionEngine: "",
  MerkleDistributor: "",
  RetroFunding: "",
}

export const RETROFUNDING_ABI = [
  "function proposeDistribution(bytes32 distributionId, uint256 pot, uint256 disputeDuration)",
  "function submitDispute(bytes32 distributionId, uint256 bond, bytes32 evidenceHash) payable",
  "function resolveDispute(bytes32 distributionId, bool valid)",
  "function finalizeDistribution(bytes32 distributionId)",
  "function claim(bytes32 distributionId, address recipient, uint256 amount, uint256 leafIndex, bytes32[] calldata proof) payable",
  "function getStatus(bytes32 distributionId) view returns (uint8)",
  "function getPot(bytes32 distributionId) view returns (uint256)",
  "function isDisputeOpen(bytes32 distributionId) view returns (bool)",
  "function getDisputeDeadline(bytes32 distributionId) view returns (uint256)",
  "function isFinalized(bytes32 distributionId) view returns (bool)",
  "function getDisputeEvidence(bytes32 distributionId) view returns (bytes32)",
  "event DistributionProposed(bytes32 indexed distributionId, uint256 pot, uint256 deadline)",
  "event DisputeSubmitted(bytes32 indexed distributionId, address disputant, uint256 bond, bytes32 evidenceHash)",
  "event DisputeResolved(bytes32 indexed distributionId, bool valid)",
  "event DistributionFinalized(bytes32 indexed distributionId)",
]

export const JURY_ABI = [
  "function registerJuror(address juror)",
  "function submitJudgment(bytes32 distributionId, address packageA, address packageB, uint8 winner, uint8 v, bytes32 r, bytes32 s)",
  "function getJudgment(bytes32 distributionId, address juror, address packageA, address packageB) view returns (uint8 winner, bool submitted)",
  "function isRegisteredJuror(address juror) view returns (bool)",
  "function getNonce(address juror) view returns (uint256)",
  "function getDomainSeparator() view returns (bytes32)",
  "event JurorRegistered(address indexed juror)",
  "event JudgmentSubmitted(bytes32 indexed distributionId, address indexed juror, address packageA, address packageB, uint8 winner)",
]

export const MERKLE_ABI = [
  "function claim(bytes32 distributionId, address recipient, uint256 amount, uint256 leafIndex, bytes32[] calldata proof) external payable",
  "function getRoot(bytes32 distributionId) view returns (bytes32)",
  "function isClaimed(bytes32 distributionId, address recipient) view returns (bool)",
  "function isFinalized(bytes32 distributionId) view returns (bool)",
  "function getPot(bytes32 distributionId) view returns (uint256)",
  "event Claimed(address indexed recipient, uint256 indexed amount, bytes32 indexed distributionId)",
  "event RootCommitted(bytes32 indexed distributionId, bytes32 root)",
]

export const DISTRIBUTION_ABI = [
  "function computeDistribution(address[] packages, uint256[] weights, uint256[] retention, uint256[][] depIndices, uint256 pot, uint256 rootIndex, uint256 maxRounds) returns (uint256[] allocations, uint256 dust)",
  "function commitDistribution(bytes32 distributionId, address[] packages, uint256[] allocs, uint256 dustAmount, address root, bytes32 merkleRoot)",
  "function getAllocation(bytes32 distributionId, address pkg) view returns (uint256)",
  "function getPot(bytes32 distributionId) view returns (uint256)",
  "function getDust(bytes32 distributionId) view returns (uint256)",
  "function getMerkleRoot(bytes32 distributionId) view returns (bytes32)",
  "function assertConservation(bytes32 distributionId) view",
  "function isFinalized(bytes32 distributionId) view returns (bool)",
]

export const GRAPH_ABI = [
  "function registerPackage(address pkg, bytes32 packageId, uint256 retentionRate) returns (bool)",
  "function addDependency(address depender, address dependency)",
  "function validateNoCycle(uint256 depthLimit)",
  "function getPackages() view returns (address[])",
  "function getDependencies(address pkg) view returns (address[])",
  "function getRetention(address pkg) view returns (uint256)",
  "function graphVersion() view returns (uint256)",
  "function graphHash() view returns (bytes32)",
]

export const DISTRIBUTION_STATUS: Record<number, string> = {
  0: "PROPOSED",
  1: "DISPUTED",
  2: "INVALIDATED",
  3: "FINALIZED",
}

export const SEPOLIA_CHAIN_ID = 11155111
