import { useLocation } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
const titles: Record<string, string> = { '/members': 'Members', '/membership-plans': 'Membership Plans', '/payments': 'Payments', '/renewals': 'Renewals', '/reminders': 'Reminders', '/reports': 'Reports', '/trainers': 'Trainers', '/settings': 'Settings' }
export function ComingSoonPage() { const title = titles[useLocation().pathname] ?? 'Section'; return <><PageHeader title={title} description="Your gym operations, thoughtfully organized."/><EmptyState title={title}/></> }
