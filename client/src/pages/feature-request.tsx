import { FeedbackForm } from "@/components/FeedbackForm";

export default function FeatureRequest() {
  return (
    <FeedbackForm
      title="Feature Request"
      heading="What feature would you like?"
      body="Tell us about a feature you'd love to see in Bubble. The more detail you share, the better we can understand your needs."
      placeholder="Describe the feature you'd like to see..."
      type="feature_request"
      submitLabel="Submit Request"
      successTitle="Thank you!"
      successBody="Your feature request has been submitted. We appreciate your input!"
    />
  );
}
