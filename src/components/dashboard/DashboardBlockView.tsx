import type { DashboardBlockType } from './layout';
import type { DashboardData } from './useDashboardData';
import FocusBlock from './blocks/FocusBlock';
import GreetingBlock from './blocks/GreetingBlock';
import ProgressBlock from './blocks/ProgressBlock';
import TeamsBlock from './blocks/TeamsBlock';
import TodayBlock from './blocks/TodayBlock';

export default function DashboardBlockView({
  type,
  data,
}: {
  type: DashboardBlockType;
  data: DashboardData;
}) {
  switch (type) {
    case 'greeting':
      return <GreetingBlock data={data} />;
    case 'focus':
      return <FocusBlock data={data} />;
    case 'progress':
      return <ProgressBlock data={data} />;
    case 'today':
      return <TodayBlock data={data} />;
    case 'teams':
      return <TeamsBlock data={data} />;
  }
}
