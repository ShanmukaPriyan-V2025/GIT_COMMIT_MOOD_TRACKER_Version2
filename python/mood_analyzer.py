import sys
import json
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

commit_messages = json.loads(sys.stdin.read())

results = []
summary = {"Positive": 0, "Neutral": 0, "Negative": 0}

for msg in commit_messages:
    score = analyzer.polarity_scores(msg)["compound"]

    if score >= 0.05:
        mood = "Positive"
    elif score <= -0.05:
        mood = "Negative"
    else:
        mood = "Neutral"

    summary[mood] += 1

    results.append({
        "message": msg,
        "mood": mood,
        "confidence": round(abs(score), 2)
    })

print(json.dumps({
    "summary": summary,
    "commits": results
}))
