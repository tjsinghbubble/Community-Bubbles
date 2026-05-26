# fast-delete

Atomically replace a large directory with an empty one, then delete the old
contents in the background. Use this instead of `rm -rf` for large directories
(node_modules, build artifacts, AVD images, Pods) to avoid blocking.

## Applicability — do not use on irreplaceable directories

Only apply this command to directories whose contents are **entirely
re-creatable from source** — i.e., the directory can be fully restored by
running a standard tool with no data loss. Confirmed safe targets:

- `node_modules/` — restored by `npm install` / `npx expo install`
- `mobile/android/build`, `app/build`, `.gradle/` — restored by `./gradlew`
- `mobile/ios/` — restored by `expo prebuild` + `pod install`
- `~/.android/avd/<name>` — restored by creating a new AVD in Android Studio
- `~/Library/Developer/Xcode/DerivedData` — restored by building in Xcode
- `~/Library/Developer/CoreSimulator/Devices` — restored by Simulator

**Never use on**: source code, databases, user data, git history, dotfiles,
any directory not produced by a deterministic build or install tool.

## Steps

Given a target path $ARGUMENTS:

1. Generate a unique trash name using PID and $RANDOM:
   `"<parent>/delete-dir-$$-$RANDOM"`
   Using both ensures uniqueness across parallel executions and avoids
   collision with leftover trash from earlier failed runs.
2. Rename the target to the trash name (`mv`). This is atomic on the same
   filesystem and returns immediately regardless of directory size.
3. Re-create the target as an empty directory (`mkdir`).
4. Immediately apply all three exclusions to the new empty directory, BEFORE
   any install or build tool starts populating it:
   ```
   touch "<target>/.metadata_never_index"
   xattr -w com.apple.icloud.donotbackup 1 "<target>"
   tmutil addexclusion "<target>"
   ```
   This prevents iCloud from seeing files arrive during the install. The
   postinstall hook is a safety net but runs too late to prevent this.
5. Also apply the iCloud exclusion xattr to the trash copy so iCloud stops
   tracking its contents as they are deleted:
   `xattr -w com.apple.icloud.donotbackup 1 "<trash>"`
6. Clear any immutable flags on the trash copy:
   `find "<trash>" -flags +uchg -exec chflags nouchg {} \; 2>/dev/null`
6. Delete the trash copy in the background:
   `rm -rf "<trash>" &`
7. Report the trash name and background PID so the user knows what's running.

## Notes

- Always use this pattern for directories larger than ~100 MB.
- If the target does not exist, skip silently (nothing to delete).
- iCloud (`com.apple.icloud.donotbackup`) and Time Machine (`tmutil
  addexclusion`) xattrs do NOT survive delete+recreate — re-run
  `scripts/exclude-dev-tools-from-cloud.sh` after the new directory is
  populated (the postinstall hook does this automatically for node_modules).
- The Spotlight sentinel (`touch .metadata_never_index`) placed in step 4
  IS directory-scoped and covers all new inodes created inside the directory.
- The background delete will complete on its own; no need to wait for it.
