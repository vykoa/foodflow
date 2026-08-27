import TransactionProgress from "./TransactionProgress";
import RiskBadge from "./RiskBadge";

// Compact shared list of transactions, used on the producer and buyer
// homes so every role watches the same chain from its own angle.
export default function TransactionList({ transactions, perspective, onOpen, emptyText }) {
  if (!transactions?.length) {
    return <p className="panel mt-2 p-4 text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div className="mt-2 space-y-2.5">
      {transactions.map((tx) => {
        // A producer cares who it's going to; a buyer cares where it came from.
        const counterparty = perspective === "producer" ? tx.buyer_name : tx.producer_name;
        const direction = perspective === "producer" ? "to" : "from";
        return (
          <button
            key={tx.id}
            onClick={() => onOpen?.(tx.id)}
            className="panel w-full p-4 text-left transition hover:border-brand-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {tx.quantity} {tx.unit} {tx.food_item.toLowerCase()}
                  </span>
                  <span className="text-sm text-ink/50">{direction} {counterparty}</span>
                  <RiskBadge level={tx.inventory_waste_risk} />
                </div>
                <p className="mt-1 text-sm text-ink/60">
                  {tx.distributor_name
                    ? `Carried by ${tx.distributor_name}`
                    : "Waiting for a distributor"} · {tx.distance_km} km
                </p>
              </div>
              <div className="flex items-center gap-3">
                <TransactionProgress stages={tx.progress} compact />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  {tx.status_label}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
