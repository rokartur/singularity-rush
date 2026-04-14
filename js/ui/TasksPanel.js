import { formatNumber } from '../utils/Math.js';
import resourcesData from '../data/resources.js';

export function renderTasksPanel(metaState) {
  const tasks = metaState.activeTasks;

  if (!tasks || tasks.length === 0) {
    return `
      <div class="tasks-header">
        <span class="tasks-title">ACTIVE TASKS</span>
        <button class="tasks-refresh-btn" onclick="window.station.refreshTasks()">GET TASKS</button>
      </div>
      <div class="tasks-empty">No active tasks. Click GET TASKS to receive new assignments.</div>
    `;
  }

  return `
    <div class="tasks-header">
      <span class="tasks-title">ACTIVE TASKS</span>
      <span class="tasks-count">${metaState.completedTaskCount} completed</span>
    </div>
    <div class="tasks-list">
      ${tasks.map((task, i) => {
        const pct = Math.min(100, (task.progress / task.def.target) * 100);
        const rewardEntries = Object.entries(task.def.reward?.resources || {});
        const rewardHtml = rewardEntries.map(([res, amount]) =>
          `<span class="task-reward" style="color:${resourcesData.resources[res]?.color || '#aaa'}">+${formatNumber(amount)} ${resourcesData.resources[res]?.name || res}</span>`
        ).join(' ');

        return `
          <div class="task-card ${task.completed ? 'completed' : ''} ${task.claimed ? 'claimed' : ''}">
            <div class="task-name">${task.def.name}</div>
            <div class="task-desc">${task.def.description.replace('{target}', task.def.target)}</div>
            <div class="task-progress-wrap">
              <div class="task-progress-bar" style="width:${pct}%"></div>
              <span class="task-progress-text">${task.progress}/${task.def.target}</span>
            </div>
            <div class="task-footer">
              <div class="task-rewards">${rewardHtml}</div>
              ${task.completed && !task.claimed
                ? `<button class="task-claim-btn" onclick="window.station.claimTask(${i})">CLAIM</button>`
                : ''}
              ${task.claimed ? '<span class="task-claimed-label">CLAIMED</span>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
