from pathlib import Path

Import("env")

from feature_config import resolve_features, source_filter_for, summary

project_dir = Path(env.subst("$PROJECT_DIR"))
resolved = resolve_features(project_dir)

env.Append(CPPDEFINES=[(name, value) for name, value in sorted(resolved.items())])
env.Replace(SRC_FILTER=source_filter_for(resolved))
print(f"Feature selection: {summary(resolved)}")
