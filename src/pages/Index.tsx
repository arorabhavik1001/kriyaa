import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickTasks } from "@/components/dashboard/QuickTasks";
import { RecentNotes } from "@/components/dashboard/RecentNotes";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { CheckSquare, FileText, Clock, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Index = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    openTasks: 0,
    notesCount: 0
  });

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(collection(db, "tasks"), where("userId", "==", user.uid), where("completed", "==", false));
    const notesQuery = query(collection(db, "notes"), where("userId", "==", user.uid));

    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      setStats(prev => ({ ...prev, openTasks: snap.size }));
    });

    const unsubNotes = onSnapshot(notesQuery, (snap) => {
      setStats(prev => ({ ...prev, notesCount: snap.size }));
    });

    return () => {
      unsubTasks();
      unsubNotes();
    };
  }, [user]);

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Hare Krishna, {user?.displayName || "User"}
          </h1>
          <p className="mt-1 text-muted-foreground">Here's what's on your plate today</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Open Tasks"
            value={stats.openTasks}
            subtitle="Active tasks"
            icon={CheckSquare}
            trend="neutral"
          />
          <StatCard
            title="Notes"
            value={stats.notesCount}
            subtitle="Total notes"
            icon={FileText}
            trend="neutral"
          />
          <StatCard
            title="Meetings Today"
            value={4}
            subtitle="Next in 45 min"
            icon={Clock}
            trend="neutral"
          />
          <StatCard
            title="Team Productivity"
            value="94%"
            subtitle="+5% this week"
            icon={TrendingUp}
            trend="up"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <QuickTasks />
            <RecentNotes />
          </div>
          <div>
            <UpcomingEvents />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
