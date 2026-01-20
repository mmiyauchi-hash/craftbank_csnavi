import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import AudioRecorder from '../components/AudioRecorder';
import ChatPanel from '../components/ChatPanel';
import { useAppStore } from '../store/useAppStore';
import { getProject } from '../lib/database';
import type { Project } from '../types/project';
import { CONSTRUCTION_TYPE_LABELS } from '../types/meeting';

function HomePage() {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const projectId = paramProjectId || queryProjectId;

  // デバッグログ (最新版)
  console.log('[HomePage] render:', { paramProjectId, queryProjectId, projectId });

  const { checklist, setChecklist, setMeetingPlan, clearMeetingPlan, meetingPlan } = useAppStore();
  const [project, setProject] = useState<Project | null>(null);

  // プロジェクトIDがある場合、案件データをロードしてストアにセット
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) {
        setProject(null);
        clearMeetingPlan(); // プロジェクトIDがない場合はプランをクリア
        return;
      }

      try {
        console.log('[HomePage] 案件データを読み込み中...', projectId);
        const projectData = await getProject(projectId);
        console.log('[HomePage] 取得した案件データ:', projectData);
        
        if (projectData) {
          setProject(projectData);
          console.log('[HomePage] 案件データをロードしました:', projectData.name);
          console.log('[HomePage] meetingPlan:', projectData.meetingPlan);
          console.log('[HomePage] meetingVariables:', projectData.meetingVariables);

          // チェックリストがある場合、ストアにセット
          if (projectData.checklist) {
            console.log('[HomePage] チェックリストをストアにセット');
            setChecklist(projectData.checklist);
          }

          // 商談プランがある場合、ストアにセット
          if (projectData.meetingPlan) {
            console.log('[HomePage] 商談プランをストアにセット', {
              checklistItems: projectData.meetingPlan.checklistItems?.length,
              proposalStrategy: !!projectData.meetingPlan.proposalStrategy,
              conversationFlow: projectData.meetingPlan.conversationFlow?.length
            });
            setMeetingPlan(projectData.meetingPlan, projectData.meetingVariables);
            
            // セット後に確認
            console.log('[HomePage] セット後のストア確認', { meetingPlan: !!meetingPlan });
          } else {
            console.log('[HomePage] 商談プランがないためクリア');
            clearMeetingPlan(); // プランがない場合はクリア
          }
        } else {
          // 案件が見つからない場合
          console.log('[HomePage] 案件が見つかりませんでした');
          setProject(null);
          clearMeetingPlan();
        }
      } catch (error) {
        console.error('案件データのロードに失敗しました:', error);
        setProject(null);
        clearMeetingPlan();
      } finally {
        // Loading state removed
      }
    };

    loadProjectData();
  }, [projectId]); // setMeetingPlan, clearMeetingPlanは依存配列に含めない（Zustandのアクションは安定している）

  const totalItems = project?.meetingPlan?.checklistItems 
    ? project.meetingPlan.checklistItems.length 
    : checklist.categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 案件情報のヘッダー（プロジェクト指定時のみ） */}
      {project && (
        <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div>
            <div className="text-sm text-gray-500 mb-1">現在録音中の案件</div>
            <h1 className="text-xl font-bold text-gray-800">{project.name}</h1>
            <div className="text-sm text-gray-600 mt-1">
              {project.meetingVariables?.constructionTypes && project.meetingVariables.constructionTypes.length > 0 && (
                <span className="mr-3">
                  🏢 {project.meetingVariables.constructionTypes.map(type => CONSTRUCTION_TYPE_LABELS[type]).join('・')}
                </span>
              )}
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
                {project.status === 'draft' ? '準備中' : '進行中'}
              </span>
            </div>
          </div>
          <Link 
            to={`/projects/${project.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            案件詳細へ ➜
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
        {/* 左側：録音パネル */}
        <div className="bg-white rounded-lg shadow-md p-6 overflow-auto">
          <AudioRecorder projectId={projectId || undefined} project={project} />

          {/* 現在のチェックリスト概要 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">📋 現在の商談プラン</h3>
              <span className="text-sm text-gray-500">{totalItems}項目</span>
            </div>
            {project?.meetingPlan ? (
              // プロジェクトのプランがある場合
              <div>
                <div className="text-sm text-gray-600 mb-2">
                  {project.name}向けのカスタム商談プラン
                </div>
                <div className="text-xs text-gray-500">
                  ※ チェックリストの内容は右側のチャットパネルで確認できます
                </div>
              </div>
            ) : (
              // デフォルトのチェックリスト表示
              <div>
                <div className="text-sm text-gray-600 mb-2">{checklist.name}</div>
                <div className="flex flex-wrap gap-2">
                  {checklist.categories.map((cat, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs"
                    >
                      {cat.name} ({cat.items.length})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側：チャットパネル */}
        <div className="h-full">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
