import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AIAgentDashboard from '../components/AIAgentDashboard';
import Layout from '../components/Layout';

const AIAgentDashboardPage = () => {
  const { user } = useAuth();

  // Check if user has permission to access AI agent dashboard
  if (user?.role !== 'admin' && user?.role !== 'agent') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access the AI Agent Dashboard.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AIAgentDashboard />
      </div>
    </Layout>
  );
};

export default AIAgentDashboardPage; 