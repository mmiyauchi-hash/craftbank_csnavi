/**
 * 案件一覧ページ
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project, ProjectStats } from '../types/project';
import { PROJECT_STATUS_LABELS } from '../types/project';
import {
  getAllProjects,
  getProjectStats,
  deleteProject,
} from '../lib/database';

function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // データ読み込み
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projectsData, statsData] = await Promise.all([
        getAllProjects(),
        getProjectStats(),
      ]);
      setProjects(projectsData);
      setStats(statsData);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 新規案件作成 → 商談準備ページへ遷移
  const handleCreateNewProject = () => {
    navigate('/prep');
  };

  // 案件削除
  const handleDeleteProject = async (id: string) => {
    if (!confirm('この案件を削除しますか？紐づく録音データも削除されます。')) return;

    try {
      await deleteProject(id);
      await loadData();
    } catch (error) {
      console.error('案件削除エラー:', error);
    }
  };

  // 時間フォーマット
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}時間${mins}分`;
    }
    return `${mins}分`;
  };

  // ステータスバッジ
  const StatusBadge = ({ status }: { status: Project['status'] }) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-600',
      in_progress: 'bg-blue-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
      archived: 'bg-yellow-100 text-yellow-600',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {PROJECT_STATUS_LABELS[status]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📁 案件管理</h1>
          <p className="text-gray-600">商談案件と録音データを管理</p>
        </div>
        <button
          onClick={handleCreateNewProject}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <span>➕</span>
          新規案件を作成
        </button>
      </div>

      {/* 統計カード */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-blue-600">{stats.totalProjects}</div>
            <div className="text-sm text-gray-500">総案件数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-green-600">{stats.totalRecordings}</div>
            <div className="text-sm text-gray-500">総録音数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-purple-600">{stats.totalAnalyses}</div>
            <div className="text-sm text-gray-500">総分析数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-orange-600">
              {formatDuration(stats.totalRecordingDuration)}
            </div>
            <div className="text-sm text-gray-500">総録音時間</div>
          </div>
        </div>
      )}

      {/* 案件一覧 */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">案件がありません</h2>
          <p className="text-gray-500 mb-4">
            商談準備ページで新しい案件を作成してください。<br />
            商談プランが自動生成されます。
          </p>
          <button
            onClick={handleCreateNewProject}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ➕ 新規案件を作成（商談準備へ）
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  案件名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  録音数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新日時
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{project.name}</div>
                      {project.meetingPlan && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          📋 プランあり
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs mt-1">
                        {project.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {project.recordingIds.length}件
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(project.updatedAt).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      🗑️ 削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export default ProjectsPage;
