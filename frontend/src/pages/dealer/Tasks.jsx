import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function Tasks() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Follow-ups, service calls and to-dos" />
      <ComingSoon
        title="Tasks"
        note="Assigned tasks, due dates and completion tracking for your dealership will appear here."
      />
    </>
  )
}
