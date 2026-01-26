import torch
from transformers import AutoModel


class EmergencyClassifier(torch.nn.Module):
    def __init__(self, num_incident_types, num_severity_classes, backbone="xlm-roberta-base"):
        super(EmergencyClassifier, self).__init__()
        self.backbone = AutoModel.from_pretrained(backbone)
        self.dropout = torch.nn.Dropout(0.3)

        # Multi-label incident types (sigmoid head)
        self.type_classifier = torch.nn.Linear(self.backbone.config.hidden_size, num_incident_types)

        # Single-label severity (softmax head)
        self.severity_classifier = torch.nn.Linear(self.backbone.config.hidden_size, num_severity_classes)

    def forward(self, input_ids, attention_mask):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.last_hidden_state[:, 0]  # CLS token
        pooled_output = self.dropout(pooled_output)

        type_logits = self.type_classifier(pooled_output)  # use sigmoid in training/eval
        severity_logits = self.severity_classifier(pooled_output)  # use softmax in training/eval

        return {"type_logits": type_logits, "severity_logits": severity_logits}