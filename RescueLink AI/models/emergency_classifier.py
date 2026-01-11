import torch.nn as nn
from transformers import DistilBertModel

class EmergencyClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.bert = DistilBertModel.from_pretrained("distilbert-base-uncased")
        self.dropout = nn.Dropout(0.3)

        self.type_head = nn.Linear(768, 6)
        self.severity_head = nn.Linear(768, 4)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        pooled = outputs.last_hidden_state[:, 0]
        pooled = self.dropout(pooled)

        return {
            "type_logits": self.type_head(pooled),
            "severity_logits": self.severity_head(pooled)
        }
