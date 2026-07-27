import React, { useState, useEffect, useRef } from 'react';
import { Pickaxe, Send, RotateCcw, Radio, LogOut } from 'lucide-react';

const COLORS = {
  bg: '#0E1116',
  panel: '#161B22',
  panel2: '#1B222C',
  bone: '#E8E6DE',
  boneDim: '#9AA0AC',
  brass: '#C68A45',
  verdigris: '#4FA98A',
  rust: '#B4532A',
  hairline: '#2A2F38',
};

const NODES = [
  { id: 'alice', name: 'Alice', x: 18.5, y: 24, color: COLORS.brass },
  { id: 'bob', name: 'Bob', x: 81.5, y: 24, color: COLORS.verdigris },
  { id: 'carol', name: 'Carol', x: 50, y: 82, color: COLORS.rust },
];
const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]));
const EDGES = [
  ['alice', 'bob'],
  ['bob', 'carol'],
  ['carol', 'alice'],
];

const GENESIS = {
  index: 0,
  previousHash: '0'.repeat(64),
  timestamp: Date.parse('2026-01-01'),
  nonce: 0,
  transactions: [],
  hash: '0'.repeat(64),
  minerId: null,
};

function randomAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function short(str, head = 8, tail = 6) {
  if (!str) return '';
  return str.length <= head + tail + 1 ? str : `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function balanceAt(chainSlice, address) {
  let bal = 0;
  for (const block of chainSlice) {
    for (const tx of block.transactions) {
      if (tx.from === address) bal -= tx.amount;
      if (tx.to === address) bal += tx.amount;
    }
  }
  return bal;
}

function Pulse({ from, to, color, onArrive }) {
  const [pos, setPos] = useState(from);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPos(to));
    const t = setTimeout(onArrive, 780);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%,-50%)',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 10px 3px ${color}99`,
        transition: 'left 0.75s cubic-bezier(.4,0,.2,1), top 0.75s cubic-bezier(.4,0,.2,1)',
        zIndex: 5,
      }}
    />
  );
}

function GemMark({ size = 16, color = COLORS.brass, lit = COLORS.verdigris, muted = false }) {
  const c = muted ? COLORS.boneDim : color;
  const l = muted ? COLORS.boneDim : lit;
  const op = muted ? 0.45 : 1;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ opacity: op, flexShrink: 0 }}>
      <polygon points="32,6 54.5,19 54.5,45 32,58 9.5,45 9.5,19" fill="none" stroke={c} strokeWidth="3.2" />
      <polygon points="32,21 41.5,26.5 41.5,37.5 32,43 22.5,37.5 22.5,26.5" fill="none" stroke={c} strokeWidth="2.4" />
      <line x1="32" y1="6" x2="32" y2="21" stroke={c} strokeWidth="2" />
      <line x1="54.5" y1="19" x2="41.5" y2="26.5" stroke={l} strokeWidth="2.4" />
      <line x1="54.5" y1="45" x2="41.5" y2="37.5" stroke={c} strokeWidth="2" />
      <line x1="32" y1="58" x2="32" y2="43" stroke={c} strokeWidth="2" />
      <line x1="9.5" y1="45" x2="22.5" y2="37.5" stroke={c} strokeWidth="2" />
      <line x1="9.5" y1="19" x2="22.5" y2="26.5" stroke={c} strokeWidth="2" />
    </svg>
  );
}

export default function LedgerApp() {
  const [addresses] = useState(() =>
    Object.fromEntries(NODES.map((n) => [n.id, randomAddress()]))
  );
  const [chain, setChain] = useState([GENESIS]);
  const [nodeSync, setNodeSync] = useState({ alice: 1, bob: 1, carol: 1 });
  const [mempool, setMempool] = useState([]);
  const [selected, setSelected] = useState('alice');
  const [loggedInId, setLoggedInId] = useState(null);
  const [miningNode, setMiningNode] = useState(null);
  const [miningInfo, setMiningInfo] = useState(null);
  const [difficulty, setDifficulty] = useState(3);
  const [pulses, setPulses] = useState([]);
  const [autoMineIds, setAutoMineIds] = useState({ alice: false, bob: false, carol: false });
  const lastAutoRef = useRef(null);
  const [log, setLog] = useState([{ id: 0, ts: Date.now(), text: 'Network initialized — 3 wallets created, genesis block sealed.' }]);
  const [txTo, setTxTo] = useState('bob');
  const [txAmount, setTxAmount] = useState(10);
  const logIdRef = useRef(1);

  function addLog(text) {
    setLog((l) => [{ id: logIdRef.current++, ts: Date.now(), text }, ...l].slice(0, 40));
  }

  useEffect(() => {
    if (txTo === selected) {
      const alt = NODES.find((n) => n.id !== selected);
      setTxTo(alt.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const chainForNode = (id) => chain.slice(0, nodeSync[id]);
  const balanceForNode = (id) => balanceAt(chainForNode(id), addresses[id]);

  function nameOf(address) {
    const entry = Object.entries(addresses).find(([, a]) => a === address);
    return entry ? NODE_MAP[entry[0]].name : 'Network';
  }

  function sendTransaction() {
    if (miningNode) return;
    const fromId = selected;
    const amount = Number(txAmount);
    if (!amount || amount <= 0) return;
    const bal = balanceForNode(fromId);
    if (amount > bal) {
      addLog(`✕ ${NODE_MAP[fromId].name}'s transaction rejected — insufficient balance (${bal} available).`);
      return;
    }
    const tx = {
      id: `tx-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      from: addresses[fromId],
      to: addresses[txTo],
      amount,
    };
    setMempool((m) => [...m, tx]);
    addLog(`${NODE_MAP[fromId].name} → ${NODE_MAP[txTo].name}: ${amount} CLR, broadcast to mempool (unconfirmed).`);
  }

  async function mine(minerId = selected) {
    if (miningNode) return;
    setMiningNode(minerId);
    setMiningInfo({ nonce: 0, hash: '' });

    const prevHash = chain[chain.length - 1].hash;
    const rewardTx = { id: `reward-${Date.now()}`, from: null, to: addresses[minerId], amount: 50 };
    const transactions = [...mempool, rewardTx];
    const timestamp = Date.now();
    const txString = JSON.stringify(transactions);
    const target = '0'.repeat(difficulty);

    let nonce = 0;
    let hashHex = '';
    while (true) {
      hashHex = await sha256Hex(prevHash + timestamp + txString + nonce);
      if (hashHex.startsWith(target)) break;
      nonce++;
      if (nonce % 60 === 0) {
        setMiningInfo({ nonce, hash: hashHex });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const newBlock = {
      index: chain.length,
      previousHash: prevHash,
      timestamp,
      nonce,
      transactions,
      hash: hashHex,
      minerId,
    };

    const newChain = [...chain, newBlock];
    setChain(newChain);
    setMempool([]);
    setNodeSync((s) => ({ ...s, [minerId]: newChain.length }));
    addLog(`⛏ ${NODE_MAP[minerId].name} mined block #${newBlock.index} — nonce ${nonce.toLocaleString()}, hash ${short(hashHex)}.`);
    setMiningNode(null);
    setMiningInfo(null);

    const others = NODES.filter((n) => n.id !== minerId);
    others.forEach((n, i) => {
      setTimeout(() => {
        const uid = `${Date.now()}-${n.id}-${Math.random().toString(16).slice(2, 6)}`;
        setPulses((p) => [
          ...p,
          {
            uid,
            from: { x: NODE_MAP[minerId].x, y: NODE_MAP[minerId].y },
            to: { x: n.x, y: n.y },
            color: NODE_MAP[minerId].color,
            targetId: n.id,
            height: newChain.length,
          },
        ]);
      }, i * 140);
    });
  }

  function onPulseArrive(pulse) {
    setPulses((p) => p.filter((x) => x.uid !== pulse.uid));
    setNodeSync((s) => ({ ...s, [pulse.targetId]: Math.max(s[pulse.targetId], pulse.height) }));
    addLog(`↳ ${NODE_MAP[pulse.targetId].name} received & verified block #${pulse.height - 1}.`);
  }

  function toggleAutoMine(id) {
    setAutoMineIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      addLog(`${NODE_MAP[id].name}'s auto-mining turned ${next[id] ? 'on' : 'off'}.`);
      return next;
    });
  }

  // Keeps mining running on its own: whenever no block is currently being
  // mined, pick the next wallet (round-robin) that has auto-mine enabled
  // and start it. Stops naturally once nothing is enabled.
  useEffect(() => {
    if (miningNode) return;
    const order = NODES.map((n) => n.id);
    const activeIds = order.filter((id) => autoMineIds[id]);
    if (activeIds.length === 0) return;
    let nextIdx = 0;
    if (lastAutoRef.current) {
      const idx = activeIds.indexOf(lastAutoRef.current);
      nextIdx = idx >= 0 ? (idx + 1) % activeIds.length : 0;
    }
    const nextId = activeIds[nextIdx];
    const t = setTimeout(() => {
      lastAutoRef.current = nextId;
      mine(nextId);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miningNode, autoMineIds]);

  function resetNetwork() {
    setChain([GENESIS]);
    setNodeSync({ alice: 1, bob: 1, carol: 1 });
    setMempool([]);
    setPulses([]);
    setMiningNode(null);
    setMiningInfo(null);
    setAutoMineIds({ alice: false, bob: false, carol: false });
    setLog([{ id: logIdRef.current++, ts: Date.now(), text: 'Network reset — chain cleared, wallets kept.' }]);
  }

  function logIn(id) {
    if (id === loggedInId) return;
    setSelected(id);
    setLoggedInId(id);
    addLog(`${NODE_MAP[id].name} logged in.`);
  }

  function logOut() {
    addLog(`${NODE_MAP[loggedInId].name} logged out.`);
    setLoggedInId(null);
  }

  const selectedNode = NODE_MAP[selected];
  const selectedChain = chainForNode(selected);
  const selectedBalance = balanceForNode(selected);
  const recipients = NODES.filter((n) => n.id !== selected);
  const maxHeight = chain.length;

  if (!loggedInId) {
    return (
      <div
        style={{ background: COLORS.bg, color: COLORS.bone, minHeight: '100vh', fontFamily: 'Inter, ui-sans-serif, system-ui' }}
        className="w-full flex items-center justify-center px-5"
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
          .fr { font-family: 'Fraunces', Georgia, serif; }
          .mono { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; }
        `}</style>
        <div className="w-full" style={{ maxWidth: 380 }}>
          <div className="flex flex-col items-center text-center mb-8">
            <GemMark size={40} />
            <h1 className="fr text-3xl mt-3" style={{ fontWeight: 600 }}>Clarity</h1>
            <p className="text-sm mt-1" style={{ color: COLORS.boneDim }}>Choose a wallet to enter the ledger.</p>
          </div>
          <div className="space-y-3">
            {NODES.map((n) => (
              <button
                key={n.id}
                onClick={() => logIn(n.id)}
                className="w-full flex items-center gap-3 rounded-xl p-4 text-left"
                style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
              >
                <GemMark size={26} color={n.color} />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: n.color }}>{n.name}</div>
                  <div className="mono text-[10px]" style={{ color: COLORS.boneDim }}>{short(addresses[n.id], 6, 4)}</div>
                </div>
                <div className="fr text-base" style={{ color: COLORS.bone }}>{balanceForNode(n.id)} <span className="text-[10px]" style={{ color: COLORS.boneDim }}>CLR</span></div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-center mt-6" style={{ color: COLORS.boneDim }}>
            Simulated wallets — no password needed. Pick any identity to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ background: COLORS.bg, color: COLORS.bone, minHeight: '100vh', fontFamily: 'Inter, ui-sans-serif, system-ui' }}
      className="w-full"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .fr { font-family: 'Fraunces', Georgia, serif; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; }
        .hairline { border-color: ${COLORS.hairline}; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${COLORS.hairline}; border-radius: 4px; }
      `}</style>

      <div className="max-w-5xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="text-xs tracking-widest uppercase mb-1" style={{ color: COLORS.brass }}>
              Distributed Ledger — Live Demo
            </div>
            <div className="flex items-center gap-2.5">
              <GemMark size={30} />
              <h1 className="fr text-3xl sm:text-4xl" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
                The Ledger Room
              </h1>
            </div>
            <p className="text-sm mt-1" style={{ color: COLORS.boneDim }}>
              Three wallets. One chain. Mining Clarity (CLR) with real SHA-256 proof-of-work in your browser.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={logOut}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-md"
              style={{ background: COLORS.panel, color: COLORS.boneDim, border: `1px solid ${COLORS.hairline}` }}
            >
              <LogOut size={13} /> Log out ({selectedNode.name})
            </button>
            <button
              onClick={resetNetwork}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-md"
              style={{ background: COLORS.panel, color: COLORS.boneDim, border: `1px solid ${COLORS.hairline}` }}
            >
              <RotateCcw size={13} /> Reset network
            </button>
          </div>
        </div>

        {/* Network graph */}
        <div
          className="relative w-full rounded-xl mb-6 overflow-hidden"
          style={{ aspectRatio: '600/300', background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {EDGES.map(([a, b]) => (
              <line
                key={a + b}
                x1={NODE_MAP[a].x}
                y1={NODE_MAP[a].y}
                x2={NODE_MAP[b].x}
                y2={NODE_MAP[b].y}
                stroke={COLORS.hairline}
                strokeWidth="0.4"
              />
            ))}
          </svg>

          {pulses.map((p) => (
            <Pulse key={p.uid} from={p.from} to={p.to} color={p.color} onArrive={() => onPulseArrive(p)} />
          ))}

          {NODES.map((n) => {
            const isSelected = selected === n.id;
            const isMining = miningNode === n.id;
            const behind = maxHeight - nodeSync[n.id];
            return (
              <button
                key={n.id}
                onClick={() => logIn(n.id)}
                style={{
                  position: 'absolute',
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  transform: 'translate(-50%,-50%)',
                  width: 128,
                  background: COLORS.panel2,
                  border: `1.5px solid ${isSelected ? n.color : COLORS.hairline}`,
                  boxShadow: isSelected ? `0 0 0 3px ${n.color}22` : 'none',
                  borderRadius: 10,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: n.color }}>
                    <GemMark size={13} color={n.color} lit={COLORS.verdigris} />
                    {n.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {autoMineIds[n.id] && (
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded-full"
                        style={{ background: `${COLORS.verdigris}22`, color: COLORS.verdigris }}
                      >
                        AUTO
                      </span>
                    )}
                    {isMining && <Pickaxe size={12} color={COLORS.brass} className="animate-pulse" />}
                  </div>
                </div>
                <div className="mono text-[10px]" style={{ color: COLORS.boneDim }}>{short(addresses[n.id], 5, 4)}</div>
                <div className="fr text-lg mt-1" style={{ color: COLORS.bone }}>{balanceForNode(n.id)} <span className="text-xs" style={{ color: COLORS.boneDim }}>CLR</span></div>
                <div className="text-[10px] mt-0.5" style={{ color: behind > 0 ? COLORS.rust : COLORS.boneDim }}>
                  height {nodeSync[n.id] - 1}{behind > 0 ? ` · syncing +${behind}` : ''}
                </div>
              </button>
            );
          })}

          <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[10px]" style={{ color: COLORS.boneDim }}>
            <Radio size={11} /> gossip network
          </div>
        </div>

        {/* Control panel + ledger */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Left: control panel */}
          <div className="md:col-span-2 rounded-xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
            <div className="text-xs tracking-widest uppercase mb-1" style={{ color: selectedNode.color }}>
              {selectedNode.name}'s wallet
            </div>
            <div className="mono text-[11px] mb-4 break-all" style={{ color: COLORS.boneDim }}>{addresses[selected]}</div>

            <div className="fr text-4xl mb-1">{selectedBalance}</div>
            <div className="text-xs mb-5" style={{ color: COLORS.boneDim }}>CLR · confirmed balance</div>

            <div className="mb-5" style={{ borderTop: `1px solid ${COLORS.hairline}` }} />

            <div className="mb-5">
              <div className="text-xs mb-2" style={{ color: COLORS.boneDim }}>Send Clarity</div>
              <div className="flex gap-2 mb-2">
                <select
                  value={txTo}
                  onChange={(e) => setTxTo(e.target.value)}
                  className="flex-1 text-sm rounded-md px-2 py-2"
                  style={{ background: COLORS.panel2, border: `1px solid ${COLORS.hairline}`, color: COLORS.bone }}
                >
                  {recipients.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-20 text-sm rounded-md px-2 py-2 mono"
                  style={{ background: COLORS.panel2, border: `1px solid ${COLORS.hairline}`, color: COLORS.bone }}
                />
              </div>
              <button
                onClick={sendTransaction}
                disabled={!!miningNode}
                className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-md"
                style={{ background: COLORS.hairline, color: COLORS.bone, opacity: miningNode ? 0.5 : 1 }}
              >
                <Send size={14} /> Sign & broadcast
              </button>
            </div>

            <div className="mb-5" style={{ borderTop: `1px solid ${COLORS.hairline}` }} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: COLORS.boneDim }}>Mining difficulty</span>
                <div className="flex gap-1">
                  {[2, 3, 4].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      disabled={!!miningNode}
                      className="text-[10px] px-2 py-1 rounded"
                      style={{
                        background: difficulty === d ? COLORS.brass : COLORS.panel2,
                        color: difficulty === d ? COLORS.bg : COLORS.boneDim,
                      }}
                    >
                      {d === 2 ? 'Easy' : d === 3 ? 'Normal' : 'Hard'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mb-2 mt-3">
                <span className="text-xs" style={{ color: COLORS.boneDim }}>Auto-mine for {selectedNode.name}</span>
                <button
                  onClick={() => toggleAutoMine(selected)}
                  className="text-[10px] px-3 py-1 rounded-full"
                  style={{
                    background: autoMineIds[selected] ? COLORS.verdigris : COLORS.panel2,
                    color: autoMineIds[selected] ? COLORS.bg : COLORS.boneDim,
                  }}
                >
                  {autoMineIds[selected] ? 'On' : 'Off'}
                </button>
              </div>
              <button
                onClick={() => mine()}
                disabled={!!miningNode}
                className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-md font-medium"
                style={{ background: COLORS.brass, color: COLORS.bg, opacity: miningNode && miningNode !== selected ? 0.5 : 1 }}
              >
                <Pickaxe size={14} />
                {miningNode === selected
                  ? `Mining… nonce ${miningInfo?.nonce.toLocaleString() || 0}`
                  : `Mine block (${mempool.length} pending tx)`}
              </button>
              {miningNode === selected && miningInfo && (
                <div className="mono text-[10px] mt-2 truncate" style={{ color: COLORS.boneDim }}>
                  {miningInfo.hash}
                </div>
              )}
              {autoMineIds[selected] && (
                <div className="text-[10px] mt-2" style={{ color: COLORS.verdigris }}>
                  Auto-mining — will keep mining new blocks on its own, in rotation with any other wallet that also has it on.
                </div>
              )}
            </div>
          </div>

          {/* Right: ledger */}
          <div className="md:col-span-3 rounded-xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs tracking-widest uppercase" style={{ color: COLORS.boneDim }}>
                Ledger — {selectedNode.name}'s view
              </div>
              <div className="text-xs" style={{ color: COLORS.boneDim }}>{selectedChain.length} block{selectedChain.length === 1 ? '' : 's'}</div>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {[...selectedChain].reverse().map((b) => (
                <div key={b.index} className="py-2.5" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
                  <div className="flex items-center justify-between">
                    <span className="fr text-sm flex items-center gap-1.5">
                      <GemMark size={12} muted={b.index === 0} />
                      #{b.index}
                    </span>
                    <span className="text-[10px]" style={{ color: COLORS.boneDim }}>
                      {b.index === 0 ? 'genesis' : `${timeStr(b.timestamp)} · nonce ${b.nonce.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="mono text-[10px] mt-0.5" style={{ color: COLORS.verdigris }}>{short(b.hash, 14, 10)}</div>
                  {b.transactions.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {b.transactions.map((tx) => (
                        <div key={tx.id} className="text-[11px] flex justify-between" style={{ color: COLORS.boneDim }}>
                          <span>{tx.from ? nameOf(tx.from) : 'Network reward'} → {nameOf(tx.to)}</span>
                          <span className="mono">{tx.amount} CLR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {mempool.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${COLORS.hairline}` }}>
                <div className="text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1.5" style={{ color: COLORS.rust }}>
                  <GemMark size={11} muted color={COLORS.rust} />
                  Mempool — unconfirmed
                </div>
                {mempool.map((tx) => (
                  <div key={tx.id} className="text-[11px] flex justify-between" style={{ color: COLORS.boneDim }}>
                    <span>{nameOf(tx.from)} → {nameOf(tx.to)}</span>
                    <span className="mono">{tx.amount} CLR</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity log */}
        <div className="mt-5 rounded-xl p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: COLORS.boneDim }}>Activity</div>
          <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-1">
            {log.map((entry) => (
              <div key={entry.id} className="text-[11px] flex gap-2" style={{ color: COLORS.boneDim }}>
                <span className="mono" style={{ color: COLORS.hairline }}>{timeStr(entry.ts)}</span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
