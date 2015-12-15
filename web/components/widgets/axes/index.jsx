import classNames from 'classnames';
import i18n from 'i18next';
import React from 'react';
import { Widget, WidgetHeader, WidgetContent } from '../../widget';
import Axes from './Axes';
import './index.css';

class AxesWidget extends React.Component {
    state = {
        isCollapsed: false
    };

    handleClick(target, val) {
        if (target === 'toggle') {
            this.setState({
                isCollapsed: !!val
            });
        }
    }
    render() {
        let width = 360;
        let title = (
            <div><i className="glyphicon glyphicon-transfer"></i>{i18n._('Axes')}</div>
        );
        let toolbarButtons = [
            'toggle'
        ];
        let widgetContentClass = classNames(
            { 'hidden': this.state.isCollapsed }
        );

        return (
            <div data-component="Widgets/AxesWidget">
                <Widget width={width}>
                    <WidgetHeader
                        title={title}
                        toolbarButtons={toolbarButtons}
                        handleClick={::this.handleClick}
                    />
                    <WidgetContent className={widgetContentClass}>
                        <Axes />
                    </WidgetContent>
                </Widget>
            </div>
        );
    }
}

export default AxesWidget;