import { WSCompatibleDatafeedBase } from './ws-compatible-datafeed-base';
class WSCompatibleDatafeed extends WSCompatibleDatafeedBase {
  constructor(datafeedURL) {
    super(datafeedURL);
  }
}
export { WSCompatibleDatafeed };