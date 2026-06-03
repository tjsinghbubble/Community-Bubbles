# Guide: GCP API Restrictions and Hard Budget Kill-Switches

To fully insulate yourself from devastating cloud overbilling, you must implement a multi-layered defense. Google Cloud Platform (GCP) handles security via **API Restrictions** (preventing key misuse) and cost control via an **Automated Hard Kill-Switch** (shutting down services if a leak bypasses restrictions).

---

## Layer 1: Implementing Strict GCP API Restrictions

Never allow a raw API key to exist without scoping boundaries. Go to **APIs & Services > Credentials** in the GCP Console, select your key, and apply both constraint types:

### 1. Application Restrictions (Where it can be used)
This stops attackers from running your key on external unauthorized servers or command-line scripts.
*   **Websites (HTTP referrers):** Best for frontend maps integrations. Restrict requests to specific domain patterns like `*://*`.
*   **IP Addresses:** Best for server-to-server microservices. Restrict access solely to your fixed backend infrastructure IPs.
*   **Mobile Apps:** Locks usage exclusively to your specific Android SHA-1 fingerprints or iOS bundle IDs.

### 2. API Restrictions (What it can call)
This explicitly mitigates the legacy key flaw by stopping an attacker from pivoting your key toward high-cost services.
*   Select **Restrict Key**.
*   Check *only* the specific services required (e.g., **Maps JavaScript API**, **Geocoding API**).
*   Leave all other checkboxes—especially **Generative Language API (Gemini)** and **Vertex AI**—strictly unchecked.

### 3. Quota Caps (How much it can cost)
Even a restricted key can be spammed by an attacker to run up your bill. 
*   Go to **APIs & Services > Dashboard**, click on your enabled API, and select **Quotas**.
*   Set an explicit cap on **Requests per day**. For example, capping requests at 5,000 per day forces Google to automatically return an error if a bot tries to spam your endpoints.

---

## Layer 2: Setting up a Hard Budget Kill-Switch

GCP does **not** offer a native "stop-at-threshold" checkbox; a standard budget alert will only send an email while your services continue to run. To build an absolute, automated stop-loss kill-switch, you must link budget tracking to programmatic shutdown code.

### Step 1: Create a Pub/Sub Topic
1. Go to **Pub/Sub > Topics** in the console.
2. Click **Create Topic** and name it `billing-alarm-topic`.

### Step 2: Configure a Budget and Link the Topic
1. Navigate to **Billing > Budgets & Alerts**.
2. Click **Create Budget**, scope it to your project, and choose a strict maximum threshold amount (e.g., 50 dollars).
3. Under **Actions**, check the box to **Connect a Pub/Sub topic to this budget**. Select your `billing-alarm-topic`. GCP will now programmatically broadcast usage data to this stream multiple times per day.

### Step 3: Deploy a Cloud Run Function (The Emergency Brake)
Deploy an official Google Cloud automated mitigation script as a lightweight Cloud Run function. Set the function trigger to watch your `billing-alarm-topic` Pub/Sub stream. 

When the function receives a message indicating your actual spending has exceeded 100% of your threshold, it executes a programmatic request to detach the project's financial pipeline:

```python
# requirements.txt dependencies:
# google-cloud-billing==1.16.2
# functions-framework==3.*

import base64
import json
import os
from google.cloud import billing_v1
from google.api_core import exceptions

def stop_billing(cloudevent):
    # Parse the incoming budget alarm payload
    pubsub_data = base64.b64decode(cloudevent.data["message"]["data"]).decode("utf-8")
    data_json = json.loads(pubsub_data)

    cost_amount = data_json.get("costAmount")
    budget_amount = data_json.get("budgetAmount")
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")

    # If spending exceeds budget, pull the plug
    if cost_amount and budget_amount and cost_amount >= budget_amount:
        client = billing_v1.CloudBillingClient()
        project_name = f"projects/{project_id}"

        try:
            # Setting billing_account_name to an empty string disables billing
            unlinked_billing_info = billing_v1.ProjectBillingInfo(billing_account_name="")
            client.update_project_billing_info(
                name=project_name, 
                project_billing_info=unlinked_billing_info
            )
            print(f"CRITICAL: Budget breached ({cost_amount}/{budget_amount}). Billing disabled for {project_id}.")
        except exceptions.PermissionDenied:
            print("Failed to disable billing. Check Cloud Run function IAM permissions.")
```

### Step 4: Grant Permissions
Your Cloud Run function's runtime Service Account must be explicitly configured with the correct IAM roles to manipulate your financials:
1. Go to the **Billing Account Management** page.
2. Add your Cloud Run function's service account as a principal.
3. Grant it the role of **Billing Account User** (or project-level **Project Billing Manager**) to allow it to detach the project programmatically.

⚠️ **Warning:** The automated kill-switch acts as an absolute emergency handbrake. When it detaches your billing account, your active VMs, cloud databases, and APIs will **immediately go offline**. This prevents catastrophic debt but will disrupt production traffic until you manually re-link a valid billing profile.