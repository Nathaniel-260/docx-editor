import { ConfigExplorer } from './config-explorer';
import { commentsConfigExplorer } from '@/lib/comments-config-explorer';

export function CommentsConfigReference() {
  return <ConfigExplorer data={commentsConfigExplorer} initialField='ui.comments.layout' />;
}
