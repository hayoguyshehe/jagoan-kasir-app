-- Phase 8: Reports Optimization

-- 1. Create Indexes for faster filtering on transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_created 
ON transactions(outlet_id, created_at, status);

-- 2. Create RPC for Sales Report
CREATE OR REPLACE FUNCTION get_sales_report(
  p_outlet_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_chart_data JSON;
  v_best_sellers JSON;
  v_stats JSON;
  v_is_monthly BOOLEAN;
BEGIN
  -- Determine grouping (Monthly if > 31 days)
  v_is_monthly := (p_end_date - p_start_date) > interval '31 days';

  -- 1. Get Chart Data (Grouped with Asia/Jakarta timezone)
  IF v_is_monthly THEN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_chart_data
    FROM (
      SELECT 
        to_char(timezone('Asia/Jakarta', created_at), 'Mon YYYY') as date,
        min(timezone('Asia/Jakarta', created_at)) as sort_date,
        SUM(total_amount) as revenue,
        COUNT(*) as transactions
      FROM transactions
      WHERE outlet_id = p_outlet_id 
        AND status = 'COMPLETED'
        AND created_at >= p_start_date 
        AND created_at <= p_end_date
      GROUP BY 1
      ORDER BY 2 ASC
    ) t;
  ELSE
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_chart_data
    FROM (
      SELECT 
        to_char(timezone('Asia/Jakarta', created_at), 'DD Mon') as date,
        min(timezone('Asia/Jakarta', created_at)) as sort_date,
        SUM(total_amount) as revenue,
        COUNT(*) as transactions
      FROM transactions
      WHERE outlet_id = p_outlet_id 
        AND status = 'COMPLETED'
        AND created_at >= p_start_date 
        AND created_at <= p_end_date
      GROUP BY 1
      ORDER BY 2 ASC
    ) t;
  END IF;

  -- 2. Get Best Sellers (Top 50)
  SELECT COALESCE(json_agg(bs), '[]'::json) INTO v_best_sellers
  FROM (
    SELECT 
      ti.product_name as "name",
      ti.serve_type as "serveType",
      SUM(ti.quantity) as qty,
      SUM(ti.subtotal) as revenue
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    WHERE t.outlet_id = p_outlet_id
      AND t.status = 'COMPLETED'
      AND t.created_at >= p_start_date 
      AND t.created_at <= p_end_date
    GROUP BY 1, 2
    ORDER BY qty DESC
    LIMIT 50
  ) bs;

  -- 3. Get Overall Stats
  SELECT json_build_object(
    'totalRevenue', COALESCE(SUM(total_amount), 0),
    'totalTransactions', COUNT(*),
    'totalDiscounts', COALESCE(SUM(discount_amount), 0)
  ) INTO v_stats
  FROM transactions
  WHERE outlet_id = p_outlet_id 
    AND status = 'COMPLETED'
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;

  -- Combine into final JSON result
  v_result := json_build_object(
    'chartData', v_chart_data,
    'bestSellers', v_best_sellers,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
