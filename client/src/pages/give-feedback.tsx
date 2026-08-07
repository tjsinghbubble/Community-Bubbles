import { FeedbackForm } from "@/components/FeedbackForm";

export default function GiveFeedback() {
  return (
    <FeedbackForm
      title="Give us Feedback"
      heading="Share your feedback"
      body="Thanks for sending us your ideas, issues, or appreciations. We can't respond individually, but we'll pass it on to the teams who are working to make Bubble better for everyone."
      placeholder="What's on your mind?"
      type="feedback"
      submitLabel="Send Feedback"
      successTitle="Feedback Sent"
      successBody="Thanks for sharing your thoughts! We can't respond individually, but it goes straight to the team."
    />
  );
}
