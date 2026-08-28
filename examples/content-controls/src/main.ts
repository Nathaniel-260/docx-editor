import 'superdoc/style.css';
import './style.css';

const workflow = new URLSearchParams(window.location.search).get('workflow') === 'fill' ? 'fill' : 'add';

document.querySelector<HTMLElement>('#authoring-panel')!.hidden = workflow !== 'add';
document.querySelector<HTMLElement>('#filling-panel')!.hidden = workflow !== 'fill';
document.querySelector<HTMLAnchorElement>(`[data-workflow-link="${workflow}"]`)!.ariaCurrent = 'page';

const workflowModule = workflow === 'fill' ? import('./filling') : import('./authoring');
const workflowLabel = workflow === 'fill' ? 'Fill fields' : 'Add fields';

void workflowModule.catch(() => {
  document.querySelector<HTMLElement>(`#${workflow === 'fill' ? 'filling' : 'authoring'}-status`)!.textContent =
    `The ${workflowLabel} workflow could not be loaded. Reload to try again.`;
});
