import { FeedbackForm } from "@/components/FeedbackForm";

export default function DefectReport() {
  return (
    <FeedbackForm
      title="Report a Bug"
      heading="Found a bug?"
      body="Describe what happened and how to reproduce it. Include any details that might help us track it down faster — what screen you were on, what you tapped, what you expected to see."
      placeholder="Describe the bug and steps to reproduce it..."
      type="defect_report"
      submitLabel="Submit Report"
      successTitle="Report Received"
      successBody="Thanks for reporting this issue. We'll look into it and work to get it fixed."
    />
  );
}
