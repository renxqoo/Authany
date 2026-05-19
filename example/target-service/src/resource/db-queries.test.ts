import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryConceptDaily, queryConceptList, queryDailyStockPool, queryFundFlow, queryStockDaily, queryStockList } from "./db-queries.js";

const queryMock = vi.fn();

vi.mock("../db.js", () => ({
  getPool() {
    return { query: queryMock };
  },
}));

describe("db query mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps stock list queries onto stock_code-based tables", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ ts_code: "000001" }] });

    await queryStockList({ keyword: "平安", page: 1, pageSize: 5 });

    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("si.stock_code LIKE $1"),
      ["%平安%"],
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("si.stock_code AS ts_code"),
      ["%平安%", 5, 0],
    );
    expect(queryMock.mock.calls[1]?.[0]).toContain("si.stock_code = sr.stock_code");
    expect(queryMock.mock.calls[1]?.[0]).toContain("sr.open_price AS open");
    expect(queryMock.mock.calls[1]?.[0]).toContain("sr.close_price AS close");
    expect(queryMock.mock.calls[1]?.[0]).toContain("sr.volume AS vol");
    expect(queryMock.mock.calls[1]?.[0]).toContain("sr.change_percent AS change_pct");
  });

  it("maps stock daily queries onto stock_daily stock_code columns", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await queryStockDaily("000034", 3);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("stock_code AS ts_code"),
      ["000034", 3],
    );
    expect(queryMock.mock.calls[0]?.[0]).toContain("change_amount AS change");
    expect(queryMock.mock.calls[0]?.[0]).toContain("change_pct AS pct_chg");
    expect(queryMock.mock.calls[0]?.[0]).toContain("volume AS vol");
    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE stock_code = $1");
  });

  it("stops ordering daily stock pool by a missing ts_code column", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await queryDailyStockPool("2026-05-17", 3);
    await queryDailyStockPool(undefined, 3);

    expect(queryMock.mock.calls[0]?.[0]).toContain("ORDER BY created_at DESC");
    expect(queryMock.mock.calls[1]?.[0]).toContain("ORDER BY trade_date DESC, created_at DESC");
  });

  it("filters fund flow by stock_code", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await queryFundFlow("000034", 3);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("stock_code AS ts_code"),
      ["000034", 3],
    );
    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE stock_code = $1");
  });

  it("orders concept list by concept_code", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    await queryConceptList({ page: 1, pageSize: 3 });

    expect(queryMock.mock.calls[1]?.[0]).toContain("ORDER BY concept_code");
  });

  it("filters concept daily by concept_code", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await queryConceptDaily("BK1168", 3);

    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE concept_code = $1");
  });
});
