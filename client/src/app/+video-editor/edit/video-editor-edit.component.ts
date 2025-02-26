import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfirmService, Notifier, ServerService } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { Video, VideoDetails } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { secondsToTime } from '@shared/core-utils'
import { VideoEditorTask, VideoEditorTaskCut } from '@shared/models'
import { VideoEditorService } from '../shared'

@Component({
  selector: 'my-video-editor-edit',
  templateUrl: './video-editor-edit.component.html',
  styleUrls: [ './video-editor-edit.component.scss' ]
})
export class VideoEditorEditComponent extends FormReactive implements OnInit {
  isRunningEdition = false

  video: VideoDetails

  constructor (
    protected formValidatorService: FormValidatorService,
    private serverService: ServerService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
    private videoEditorService: VideoEditorService,
    private loadingBar: LoadingBarService,
    private confirmService: ConfirmService
  ) {
    super()
  }

  ngOnInit () {
    this.video = this.route.snapshot.data.video

    const defaultValues = {
      cut: {
        start: 0,
        end: this.video.duration
      }
    }

    this.buildForm({
      cut: {
        start: null,
        end: null
      },
      'add-intro': {
        file: null
      },
      'add-outro': {
        file: null
      },
      'add-watermark': {
        file: null
      }
    }, defaultValues)
  }

  get videoExtensions () {
    return this.serverService.getHTMLConfig().video.file.extensions
  }

  get imageExtensions () {
    return this.serverService.getHTMLConfig().video.image.extensions
  }

  async runEdition () {
    if (this.isRunningEdition) return

    const title = $localize`Are you sure you want to edit "${this.video.name}"?`
    const listHTML = this.getTasksSummary().map(t => `<li>${t}</li>`).join('')

    // eslint-disable-next-line max-len
    const confirmHTML = $localize`The current video will be overwritten by this edited video and <strong>you won't be able to recover it</strong>.<br /><br />` +
      $localize`As a reminder, the following tasks will be executed: <ol>${listHTML}</ol>`

    if (await this.confirmService.confirm(confirmHTML, title) !== true) return

    this.isRunningEdition = true

    const tasks = this.buildTasks()

    this.loadingBar.useRef().start()

    return this.videoEditorService.editVideo(this.video.uuid, tasks)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video updated.`)
          this.router.navigateByUrl(Video.buildWatchUrl(this.video))
        },

        error: err => {
          this.loadingBar.useRef().complete()
          this.isRunningEdition = false
          this.notifier.error(err.message)
          console.error(err)
        }
      })
  }

  getIntroOutroTooltip () {
    return $localize`(extensions: ${this.videoExtensions.join(', ')})`
  }

  getWatermarkTooltip () {
    return $localize`(extensions: ${this.imageExtensions.join(', ')})`
  }

  noEdition () {
    return this.buildTasks().length === 0
  }

  getTasksSummary () {
    const tasks = this.buildTasks()

    return tasks.map(t => {
      if (t.name === 'add-intro') {
        return $localize`"${this.getFilename(t.options.file)}" will be added at the beggining of the video`
      }

      if (t.name === 'add-outro') {
        return $localize`"${this.getFilename(t.options.file)}" will be added at the end of the video`
      }

      if (t.name === 'add-watermark') {
        return $localize`"${this.getFilename(t.options.file)}" image watermark will be added to the video`
      }

      if (t.name === 'cut') {
        const { start, end } = t.options

        if (start !== undefined && end !== undefined) {
          return $localize`Video will begin at ${secondsToTime(start)} and stop at ${secondsToTime(end)}`
        }

        if (start !== undefined) {
          return $localize`Video will begin at ${secondsToTime(start)}`
        }

        if (end !== undefined) {
          return $localize`Video will stop at ${secondsToTime(end)}`
        }
      }

      return ''
    })
  }

  private getFilename (obj: any) {
    return obj.name
  }

  private buildTasks () {
    const tasks: VideoEditorTask[] = []
    const value = this.form.value

    const cut = value['cut']
    if (cut['start'] !== 0 || cut['end'] !== this.video.duration) {

      const options: VideoEditorTaskCut['options'] = {}
      if (cut['start'] !== 0) options.start = cut['start']
      if (cut['end'] !== this.video.duration) options.end = cut['end']

      tasks.push({
        name: 'cut',
        options
      })
    }

    if (value['add-intro']?.['file']) {
      tasks.push({
        name: 'add-intro',
        options: {
          file: value['add-intro']['file']
        }
      })
    }

    if (value['add-outro']?.['file']) {
      tasks.push({
        name: 'add-outro',
        options: {
          file: value['add-outro']['file']
        }
      })
    }

    if (value['add-watermark']?.['file']) {
      tasks.push({
        name: 'add-watermark',
        options: {
          file: value['add-watermark']['file']
        }
      })
    }

    return tasks
  }

}
