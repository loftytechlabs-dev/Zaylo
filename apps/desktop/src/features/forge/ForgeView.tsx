import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import type {
  ForgeModelInspection,
  DatasetAnalysis,
  DatasetColumnMapping,
  TrainingObjective,
  TrainingConfig,
  HardwareConstraintEstimates,
  PreflightReport,
  TrainingJob,
  TrainingMetricSample,
  TrainingJobStatus,
  FineTunedModelArtifact,
  ModelComparisonRequest,
  ModelComparisonResult,
} from '@local-ai/shared';

import { ForgeErrorBoundary } from './ForgeErrorBoundary';
import { ForgeHomeView } from './screens/ForgeHomeView';
import { SelectModelScreen } from './screens/SelectModelScreen';
import { ImportDatasetScreen } from './screens/ImportDatasetScreen';
import { AutoConfigScreen } from './screens/AutoConfigScreen';
import { PreflightReviewScreen } from './screens/PreflightReviewScreen';
import { LiveTrainingStudio } from './studio/LiveTrainingStudio';
import { TrainingResultsScreen } from './screens/TrainingResultsScreen';
import { FineTunedLibraryScreen } from './screens/FineTunedLibraryScreen';

type ForgeScreen =
  | 'home'
  | 'select_model'
  | 'import_dataset'
  | 'auto_config'
  | 'preflight'
  | 'live_monitor'
  | 'results'
  | 'library';

export const ForgeView: React.FC = () => {
  const { setActiveTab } = useAppStore();

  const [screen, setScreen] = useState<ForgeScreen>('home');
  const [models, setModels] = useState<ForgeModelInspection[]>([]);
  const [selectedModel, setSelectedModel] = useState<ForgeModelInspection | null>(null);

  // Dataset State
  const [dataset, setDataset] = useState<DatasetAnalysis | null>(null);
  const [objective, setObjective] = useState<TrainingObjective>('instruction');
  const [trainValSplit, setTrainValSplit] = useState<number>(0.1);
  const [columnMapping, setColumnMapping] = useState<DatasetColumnMapping>({});

  // Auto Config & Hyperparameters State
  const [config, setConfig] = useState<TrainingConfig | null>(null);
  const [estimates, setEstimates] = useState<HardwareConstraintEstimates | null>(null);
  const [isAutoConfig, setIsAutoConfig] = useState<boolean>(true);

  // Preflight State
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);

  // Jobs and Artifacts State
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [artifacts, setArtifacts] = useState<FineTunedModelArtifact[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Loading States
  const [isFetchingCheckpoint, setIsFetchingCheckpoint] = useState(false);
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const [isMergingAdapter, setIsMergingAdapter] = useState(false);

  // Fetch initial data
  const loadModels = useCallback(async () => {
    try {
      const inspected = await api.invoke('forge:list-models', undefined);
      setModels(inspected || []);
    } catch (err: any) {
      console.error('Failed to load models for Forge:', err);
    }
  }, []);

  const loadJobsAndArtifacts = useCallback(async () => {
    try {
      const [allJobs, allArtifacts] = await Promise.all([
        api.invoke('forge:list-jobs', undefined),
        api.invoke('forge:list-fine-tuned-models', undefined),
      ]);
      setJobs(allJobs || []);
      setArtifacts(allArtifacts || []);
    } catch (err: any) {
      console.error('Failed to load jobs/artifacts for Forge:', err);
    }
  }, []);

  useEffect(() => {
    loadModels();
    loadJobsAndArtifacts();

    // Subscribe to training events safely
    const unsubMetric = api.on('forge:training-metric', (event: { jobId: string; sample: TrainingMetricSample }) => {
      if (!event?.sample) return;
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j.id !== event.jobId) return j;
          const currentHistory = Array.isArray(j.metricsHistory) ? j.metricsHistory : [];
          const updatedHistory = [...currentHistory, event.sample];
          return {
            ...j,
            currentStep: event.sample.step,
            totalSteps: event.sample.totalSteps,
            currentEpoch: event.sample.epoch,
            totalEpochs: event.sample.totalEpochs,
            currentLoss: event.sample.loss,
            metricsHistory: updatedHistory.slice(-300),
          };
        })
      );
    });

    const unsubLog = api.on('forge:training-log', (event: { jobId: string; log: string }) => {
      if (!event?.log) return;
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j.id !== event.jobId) return j;
          const currentLogs = Array.isArray(j.recentLogs) ? j.recentLogs : [];
          const updatedLogs = [...currentLogs, event.log];
          return {
            ...j,
            recentLogs: updatedLogs.slice(-200),
          };
        })
      );
    });

    const unsubStatus = api.on('forge:training-status', (event: { jobId: string; status: TrainingJobStatus; error?: string }) => {
      if (!event?.status) return;
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j.id !== event.jobId) return j;
          return {
            ...j,
            status: event.status,
            error: event.error || j.error,
          };
        })
      );
      loadJobsAndArtifacts();
    });

    return () => {
      unsubMetric?.();
      unsubLog?.();
      unsubStatus?.();
    };
  }, [loadModels, loadJobsAndArtifacts]);

  // Wizard Navigation: Model Selection
  const handleSelectModel = (model: ForgeModelInspection) => {
    setSelectedModel(model);
  };

  const handleFetchCheckpoint = async (modelId: string, hfRepoId?: string) => {
    setIsFetchingCheckpoint(true);
    try {
      const res = await api.invoke('forge:fetch-checkpoint', { modelId, hfRepoId });
      if (res.success && res.checkpointPath) {
        await loadModels();
        const updated = await api.invoke('forge:inspect-model', { modelId });
        setSelectedModel(updated);
      } else {
        alert(`Failed to fetch checkpoint: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Checkpoint download error: ${err.message}`);
    } finally {
      setIsFetchingCheckpoint(false);
    }
  };

  const handleCustomCheckpointPath = (_modelId: string, customPath: string) => {
    if (selectedModel) {
      setSelectedModel({
        ...selectedModel,
        status: 'READY',
        statusReason: `Using custom Safetensors checkpoint directory.`,
        checkpointPath: customPath,
      });
    }
  };

  // Wizard Navigation: Dataset Import
  const handleSelectDatasetFile = async () => {
    try {
      const filePath = await api.invoke('forge:select-dataset-file', undefined);
      if (filePath) {
        const parsed = await api.invoke('forge:parse-dataset', { filePath, columnMapping });
        setDataset(parsed);
      }
    } catch (err: any) {
      alert(`Error reading dataset: ${err.message}`);
    }
  };

  const handleLoadSampleDataset = async (type: 'instruction' | 'conversational') => {
    try {
      const res = await api.invoke('forge:load-sample-dataset', { type });
      setDataset(res.analysis);
      setObjective(type === 'conversational' ? 'conversational' : 'instruction');
    } catch (err: any) {
      alert(`Failed to load sample dataset: ${err.message}`);
    }
  };

  const handleColumnMappingChange = async (newMapping: DatasetColumnMapping) => {
    setColumnMapping(newMapping);
    if (dataset) {
      try {
        const reParsed = await api.invoke('forge:parse-dataset', {
          filePath: dataset.filePath,
          columnMapping: newMapping,
        });
        setDataset(reParsed);
      } catch (err: any) {
        alert(`Failed to re-parse with column mapping: ${err.message}`);
      }
    }
  };

  // Step 2 -> Step 3: Run Auto Configuration
  const handleContinueToConfig = async () => {
    if (!selectedModel || !dataset) return;
    try {
      const res = await api.invoke('forge:auto-configure', {
        modelId: selectedModel.modelId,
        datasetPath: dataset.filePath,
        objective,
        columnMapping: dataset.columnMapping,
      });
      setConfig(res.config);
      setEstimates(res.estimates);
      setIsAutoConfig(true);
      setScreen('auto_config');
    } catch (err: any) {
      alert(`Auto-configuration failed: ${err.message}`);
    }
  };

  // Step 3: Hyperparameter updates
  const handleConfigChange = async (updated: Partial<TrainingConfig>) => {
    if (!config) return;
    const merged = { ...config, ...updated };
    setConfig(merged);
    setIsAutoConfig(false);

    try {
      const validation = await api.invoke('forge:validate-config', { config: merged });
      setEstimates(validation.estimates);
    } catch (err: any) {
      console.error('Validation error:', err);
    }
  };

  const handleResetAutoConfig = async () => {
    if (!selectedModel || !dataset) return;
    try {
      const res = await api.invoke('forge:auto-configure', {
        modelId: selectedModel.modelId,
        datasetPath: dataset.filePath,
        objective,
        columnMapping: dataset.columnMapping,
      });
      setConfig(res.config);
      setEstimates(res.estimates);
      setIsAutoConfig(true);
    } catch (err: any) {
      console.error('Reset failed:', err);
    }
  };

  // Step 3 -> Step 4: Run Preflight Checks
  const handleContinueToPreflight = async () => {
    if (!config) return;
    try {
      const rep = await api.invoke('forge:run-preflight', { config });
      setPreflight(rep);
      setScreen('preflight');
    } catch (err: any) {
      alert(`Preflight execution failed: ${err.message}`);
    }
  };

  const handleSelectOutputDir = async () => {
    if (!config) return;
    try {
      const chosen = await api.invoke('app:select-directory', { defaultPath: config.outputDir });
      if (chosen) {
        const updated = { ...config, outputDir: chosen };
        setConfig(updated);
        const rep = await api.invoke('forge:run-preflight', { config: updated });
        setPreflight(rep);
      }
    } catch (err: any) {
      console.error('Select dir error:', err);
    }
  };

  // Step 4: Start Training
  const handleStartTraining = async () => {
    if (!config) return;
    setIsStartingTraining(true);
    try {
      const finalConfig = {
        ...config,
        columnMapping: config.columnMapping || dataset?.columnMapping,
      };
      const res = await api.invoke('forge:start-training', { config: finalConfig });
      if (res?.started && res.jobId) {
        setActiveJobId(res.jobId);
        const [allJobs, allArtifacts] = await Promise.all([
          api.invoke('forge:list-jobs', undefined),
          api.invoke('forge:list-fine-tuned-models', undefined),
        ]);
        if (allJobs) setJobs(allJobs);
        if (allArtifacts) setArtifacts(allArtifacts);
        setScreen('live_monitor');
      }
    } catch (err: any) {
      alert(`Failed to launch fine-tuning: ${err.message}`);
    } finally {
      setIsStartingTraining(false);
    }
  };

  // Process Controls
  const handlePauseTraining = async () => {
    if (!activeJobId) return;
    await api.invoke('forge:pause-training', { jobId: activeJobId });
    loadJobsAndArtifacts();
  };

  const handleResumeTraining = async () => {
    if (!activeJobId) return;
    await api.invoke('forge:resume-training', { jobId: activeJobId });
    loadJobsAndArtifacts();
  };

  const handleCancelTraining = async () => {
    if (!activeJobId) return;
    if (confirm('Are you sure you want to cancel training? Checkpoints saved so far will be preserved.')) {
      await api.invoke('forge:cancel-training', { jobId: activeJobId });
      loadJobsAndArtifacts();
    }
  };

  const handleResumeFromCheckpoint = async (step: number) => {
    if (!activeJobId) return;
    const res = await api.invoke('forge:resume-from-checkpoint', { jobId: activeJobId, checkpointStep: step });
    if (!res?.success) {
      throw new Error(res?.error || 'Failed to resume from checkpoint');
    }
    await loadJobsAndArtifacts();
  };

  // Restore previous session or active training run
  useEffect(() => {
    if (jobs.length === 0) return;
    const savedJobId = localStorage.getItem('forge_last_active_job_id');
    // Prioritize currently active jobs first
    const active = jobs.find((j) => j.status === 'TRAINING' || j.status === 'INITIALIZING' || j.status === 'PAUSED');
    if (active && (!activeJobId || screen === 'home')) {
      setActiveJobId(active.id);
      setScreen('live_monitor');
      return;
    }
    if (savedJobId && !activeJobId) {
      const match = jobs.find((j) => j.id === savedJobId);
      if (match) {
        setActiveJobId(savedJobId);
      }
    }
  }, [jobs]);

  // Persist last selected job
  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem('forge_last_active_job_id', activeJobId);
    }
  }, [activeJobId]);

  // Artifact Actions
  const handleCompareModels = async (req: ModelComparisonRequest): Promise<ModelComparisonResult> => {
    return api.invoke('forge:compare-models', req);
  };

  const handleMergeAdapter = async (artifactId: string) => {
    setIsMergingAdapter(true);
    try {
      const res = await api.invoke('forge:merge-adapter', { artifactId });
      if (res.success) {
        alert('LoRA adapter successfully merged into a standalone Safetensors model!');
        await loadJobsAndArtifacts();
      } else {
        alert(`Failed to merge adapter: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Merge error: ${err.message}`);
    } finally {
      setIsMergingAdapter(false);
    }
  };

  const handleExportArtifact = async (artifactId: string) => {
    try {
      const dest = await api.invoke('app:select-directory', {});
      if (dest) {
        const res = await api.invoke('forge:export-artifact', { artifactId, destinationDir: dest });
        if (res.success) {
          alert(`Artifact successfully exported to ${res.exportPath}`);
        } else {
          alert(`Export failed: ${res.error}`);
        }
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    if (confirm('Delete this fine-tuned model artifact from disk and registry?')) {
      await api.invoke('forge:delete-artifact', { artifactId });
      await loadJobsAndArtifacts();
    }
  };

  const handleOpenPlayground = (_modelId: string, _adapterPath?: string) => {
    setActiveTab('playground');
  };

  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0];

  return (
    <ForgeErrorBoundary
      onReset={() => {
        setScreen('home');
        loadJobsAndArtifacts();
      }}
    >
      <div className="h-full w-full bg-[#090a0b] text-zinc-100 flex flex-col overflow-hidden">
        {screen === 'home' && (
          <ForgeHomeView
            jobs={jobs}
            artifacts={artifacts}
            onNewJob={() => setScreen('select_model')}
            onOpenJob={(jobId) => {
              setActiveJobId(jobId);
              setScreen('live_monitor');
            }}
            onOpenResults={(jobId) => {
              setActiveJobId(jobId);
              setScreen('live_monitor');
            }}
            onOpenLibrary={() => setScreen('library')}
            onDeleteArtifact={handleDeleteArtifact}
            onRefresh={loadJobsAndArtifacts}
          />
        )}

        {screen === 'select_model' && (
          <SelectModelScreen
            models={models}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            onFetchCheckpoint={handleFetchCheckpoint}
            onCustomCheckpointPath={handleCustomCheckpointPath}
            onBack={() => setScreen('home')}
            onContinue={() => setScreen('import_dataset')}
            isFetchingCheckpoint={isFetchingCheckpoint}
          />
        )}

        {screen === 'import_dataset' && (
          <ImportDatasetScreen
            dataset={dataset}
            objective={objective}
            trainValSplit={trainValSplit}
            onSelectFile={handleSelectDatasetFile}
            onLoadSample={handleLoadSampleDataset}
            onObjectiveChange={setObjective}
            onTrainValSplitChange={setTrainValSplit}
            onColumnMappingChange={handleColumnMappingChange}
            onBack={() => setScreen('select_model')}
            onContinue={handleContinueToConfig}
          />
        )}

        {screen === 'auto_config' && config && estimates && (
          <AutoConfigScreen
            config={config}
            estimates={estimates}
            isAutoConfig={isAutoConfig}
            onToggleAutoConfig={(auto) => {
              setIsAutoConfig(auto);
              if (auto) handleResetAutoConfig();
            }}
            onConfigChange={handleConfigChange}
            onResetAutoConfig={handleResetAutoConfig}
            onBack={() => setScreen('import_dataset')}
            onContinue={handleContinueToPreflight}
          />
        )}

        {screen === 'preflight' && config && estimates && (
          <PreflightReviewScreen
            config={config}
            preflight={preflight}
            estimates={estimates}
            isStarting={isStartingTraining}
            onSelectOutputDir={handleSelectOutputDir}
            onStartTraining={handleStartTraining}
            onBack={() => setScreen('auto_config')}
          />
        )}

        {screen === 'live_monitor' && (
          activeJob ? (
            <LiveTrainingStudio
              job={activeJob}
              onPause={handlePauseTraining}
              onResume={handleResumeTraining}
              onCancel={handleCancelTraining}
              onResumeFromCheckpoint={handleResumeFromCheckpoint}
              onCompare={handleCompareModels}
              onBack={() => setScreen('home')}
              onRefresh={loadJobsAndArtifacts}
              onOpenLibrary={() => setScreen('library')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-zinc-400">Loading fine-tuning session...</p>
              <button
                onClick={() => setScreen('home')}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors"
              >
                Return to Forge Home
              </button>
            </div>
          )
        )}

        {screen === 'results' && (
          activeJob ? (
            <TrainingResultsScreen
              job={activeJob}
              onCompare={handleCompareModels}
              onOpenLibrary={() => setScreen('library')}
              onOpenPlayground={handleOpenPlayground}
              onBack={() => setScreen('home')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
              <p className="text-sm text-zinc-400">No training run selected.</p>
              <button
                onClick={() => setScreen('home')}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors"
              >
                Return to Forge Home
              </button>
            </div>
          )
        )}

        {screen === 'library' && (
          <FineTunedLibraryScreen
            artifacts={artifacts}
            onOpenPlayground={handleOpenPlayground}
            onCompareWithBase={(jobId) => {
              setActiveJobId(jobId);
              setScreen('results');
            }}
            onMergeAdapter={handleMergeAdapter}
            onExport={handleExportArtifact}
            onDelete={handleDeleteArtifact}
            onBack={() => setScreen('home')}
            onRefresh={loadJobsAndArtifacts}
            isMerging={isMergingAdapter}
          />
        )}
      </div>
    </ForgeErrorBoundary>
  );
};
