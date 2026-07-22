export function validateImportState(candidate) {
  const errors = [];
  const isArray = (key) => {
    if (!Array.isArray(candidate?.[key])) errors.push(`${key} 배열이 없습니다.`);
  };
  isArray("investors");
  isArray("trades");
  isArray("cashflows");

  if (errors.length) return errors;

  candidate.investors.forEach((investor, index) => {
    if (typeof investor.id !== "string" || typeof investor.name !== "string") {
      errors.push(`investors[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.cashflows.forEach((flow, index) => {
    if (typeof flow.ownerId !== "string" || !["deposit", "withdraw"].includes(flow.type) || typeof flow.amount !== "number") {
      errors.push(`cashflows[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.trades.forEach((trade, index) => {
    if (
      typeof trade.ownerId !== "string" ||
      !["buy", "sell"].includes(trade.side) ||
      typeof trade.ticker !== "string" ||
      typeof trade.quantity !== "number" ||
      typeof trade.price !== "number" ||
      typeof trade.fx !== "number"
    ) {
      errors.push(`trades[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });

  return errors;
}
