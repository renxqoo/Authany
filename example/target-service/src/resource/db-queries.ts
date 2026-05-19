import { getPool } from "../db.js";

export async function queryStockList(options?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const pool = getPool();

  let whereClause = "";
  const params: unknown[] = [];
  if (options?.keyword) {
    whereClause = "WHERE si.stock_name LIKE $1 OR si.stock_code LIKE $1";
    params.push(`%${options.keyword}%`);
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM stock_info si ${whereClause}`,
    params,
  );

  const dataResult = await pool.query(
    `SELECT si.stock_code AS ts_code,
            si.stock_name,
            si.industry,
            COALESCE(sr.market, si.exchange) AS market,
            si.list_date,
            sr.open_price AS open,
            sr.high,
            sr.low,
            sr.close_price AS close,
            sr.volume AS vol,
            sr.amount,
            sr.change_percent AS change_pct
     FROM stock_info si
     LEFT JOIN stock_realtime sr ON si.stock_code = sr.stock_code
     ${whereClause}
     ORDER BY si.stock_code
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset],
  );

  return {
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
    data: dataResult.rows,
  };
}

export async function queryStockDaily(tsCode: string, limit = 60) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT stock_code AS ts_code,
            trade_date,
            open,
            high,
            low,
            close,
            pre_close,
            change_amount AS change,
            change_pct AS pct_chg,
            volume AS vol,
            amount
     FROM stock_daily
     WHERE stock_code = $1
     ORDER BY trade_date DESC
     LIMIT $2`,
    [tsCode, limit],
  );
  return result.rows;
}

export async function queryMarketOverview() {
  const pool = getPool();

  const [breadth, sentiment, capitalFlow] = await Promise.all([
    pool.query(
      `SELECT * FROM market_breadth ORDER BY trade_date DESC LIMIT 1`,
    ),
    pool.query(
      `SELECT * FROM market_sentiment_enhanced ORDER BY trade_date DESC LIMIT 1`,
    ),
    pool.query(
      `SELECT * FROM main_capital_flow_daily ORDER BY trade_date DESC LIMIT 1`,
    ),
  ]);

  return {
    breadth: breadth.rows[0] ?? null,
    sentiment: sentiment.rows[0] ?? null,
    capitalFlow: capitalFlow.rows[0] ?? null,
  };
}

export async function queryIndexDaily(limit = 30) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM index_daily ORDER BY trade_date DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function queryDailyStockPool(tradeDate?: string, limit = 50) {
  const pool = getPool();
  if (tradeDate) {
    const result = await pool.query(
      `SELECT * FROM daily_stock_pool WHERE trade_date = $1 ORDER BY created_at DESC LIMIT $2`,
      [tradeDate, limit],
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT * FROM daily_stock_pool ORDER BY trade_date DESC, created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function queryLimitUpStats(limit = 30) {
  const pool = getPool();
  const [stats, continuous] = await Promise.all([
    pool.query(
      `SELECT * FROM limit_up_stats ORDER BY trade_date DESC LIMIT $1`,
      [limit],
    ),
    pool.query(
      `SELECT * FROM continuous_limit_up ORDER BY trade_date DESC LIMIT $1`,
      [limit],
    ),
  ]);
  return {
    stats: stats.rows,
    continuous: continuous.rows,
  };
}

export async function queryDragonTiger(limit = 30) {
  const pool = getPool();
  const [daily, institution] = await Promise.all([
    pool.query(
      `SELECT * FROM dragon_tiger_daily ORDER BY trade_date DESC LIMIT $1`,
      [limit],
    ),
    pool.query(
      `SELECT * FROM dragon_tiger_institution ORDER BY trade_date DESC LIMIT $1`,
      [limit],
    ),
  ]);
  return {
    daily: daily.rows,
    institution: institution.rows,
  };
}

export async function queryFundFlow(tsCode: string, limit = 30) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT stock_code AS ts_code, *
     FROM fund_flow
     WHERE stock_code = $1
     ORDER BY trade_date DESC
     LIMIT $2`,
    [tsCode, limit],
  );
  return result.rows;
}

export async function queryConceptList(options?: {
  page?: number;
  pageSize?: number;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const pool = getPool();

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM concept_info`,
  );

  const dataResult = await pool.query(
    `SELECT * FROM concept_info ORDER BY concept_code LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  return {
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
    data: dataResult.rows,
  };
}

export async function queryConceptDaily(conceptCode: string, limit = 30) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM concept_daily WHERE concept_code = $1 ORDER BY trade_date DESC LIMIT $2`,
    [conceptCode, limit],
  );
  return result.rows;
}
