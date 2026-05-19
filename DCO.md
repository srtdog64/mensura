# Developer Certificate of Origin

Mensura requires a Developer Certificate of Origin (DCO) sign-off on every
contribution commit.

The sign-off line is a contributor's statement that they have the right to
submit the work under this repository's license and contribution terms.

Required commit trailer:

```txt
Signed-off-by: Full Name <email@example.com>
```

Use Git's built-in sign-off support:

```sh
git commit -s
```

To add a sign-off to the latest local commit:

```sh
git commit --amend -s --no-edit
```

To fix several local commits before opening a pull request, use an interactive
rebase and amend each commit that is missing the trailer:

```sh
git rebase -i origin/master
git commit --amend -s --no-edit
git rebase --continue
```

The trailer name and email must match an identity the contributor controls.
Bot commits must use a bot identity. Co-authored commits are allowed, but each
author who contributed code should have their own `Signed-off-by` trailer.

The full standard DCO text is maintained at:

https://developercertificate.org/

