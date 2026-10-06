import { Component, type ErrorInfo, type ReactNode } from 'react'

/* The fence around the catch view's canvas. The model loads inside the
   react-three-fiber root and a failure there (a missing or broken glTF, a
   GL context that could not be made) is rethrown into this tree; without
   a boundary it would take the whole screen down. The boundary drops the
   canvas, so the camera image and the HUD stay, and tells the screen,
   which puts the reason in the status pill. */

type Props = {
  onError: (error: unknown) => void
  children: ReactNode
}

type State = { failed: boolean }

export class CanvasBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error)
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
