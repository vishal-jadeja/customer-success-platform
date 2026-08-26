"use client";

import { useEffect } from "react";

import AtRiskList from "@/components/dashboard/AtRiskList";
import DashboardSection from "@/components/dashboard/DashboardSection";
import KpiCards from "@/components/dashboard/KpiCards";
import SentimentTrendChart from "@/components/dashboard/SentimentTrendChart";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAtRisk, fetchSentimentTrend, fetchSummary } from "@/store/slices/dashboardSlice";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const {
    summary,
    summaryStatus,
    summaryError,
    trend,
    trendDays,
    trendStatus,
    trendError,
    atRisk,
    atRiskStatus,
    atRiskError,
  } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchSummary());
    dispatch(fetchSentimentTrend({ days: 30 }));
    dispatch(fetchAtRisk({ limit: 10 }));
    // Each section's own Retry re-dispatches only its own thunk — see below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer width="wide">
      <PageHeader title="Dashboard" subtitle="Your book of business at a glance" />

      <DashboardSection
        title="Overview"
        status={summaryStatus}
        error={summaryError}
        onRetry={() => dispatch(fetchSummary())}
        skeleton={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        }
      >
        {summary && <KpiCards summary={summary} />}
      </DashboardSection>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardSection
          title="Sentiment trend"
          subtitle="Last 30 days"
          status={trendStatus}
          error={trendError}
          onRetry={() => dispatch(fetchSentimentTrend({ days: 30 }))}
          isEmpty={trendStatus === "succeeded" && trend.length === 0}
          emptyMessage="No sentiment data in the last 30 days. Insights appear here once interactions are logged."
          skeleton={<Skeleton className="h-72 w-full" />}
          className="lg:col-span-2"
        >
          <SentimentTrendChart points={trend} days={trendDays} />
        </DashboardSection>

        <DashboardSection
          title="Lowest health customers"
          subtitle="Ranked by health score, lowest first"
          status={atRiskStatus}
          error={atRiskError}
          onRetry={() => dispatch(fetchAtRisk({ limit: 10 }))}
          isEmpty={atRiskStatus === "succeeded" && atRisk.length === 0}
          emptyMessage="No customers in your book yet."
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          }
        >
          <AtRiskList customers={atRisk} />
        </DashboardSection>
      </div>
    </PageContainer>
  );
}
